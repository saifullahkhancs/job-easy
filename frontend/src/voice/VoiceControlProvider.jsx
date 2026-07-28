import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import {
  DEFAULT_MIN_SCORE,
  DEFAULT_UI_MIN_SCORE,
  FALLBACK_MIN_SCORE,
  STRICT_MIN_SCORE,
  matchCommand,
  matchUiTarget,
  normalize,
  parsePhrase,
  suggestCommands,
} from "./commandMatching";
import { getCurrentUser, logout } from "../api/client";
import { getAccessToken } from "../api/tokenStorage";

/**
 * VoiceControlProvider — Job Easy hands-free control.
 *
 * There is no wake word. Recognition runs continuously from the moment the
 * user switches voice control ON with the floating microphone button (the
 * choice is persisted in localStorage) and stops completely when muted.
 *
 * Commands mirror the text that is actually visible on screen — sidebar links,
 * page headings, quick-action cards and button titles — so "open user
 * management", "go to user management" and "user management page" all work.
 * Anything the registry does not know is matched against the labels of the
 * clickable elements currently rendered, which makes every button on every
 * page reachable by voice without touching those components.
 *
 * Performance: the recognition callback is a stable function that reads
 * everything it needs from refs, so command matching happens synchronously in
 * the speech event and never waits on a React render. Display-only state
 * (interim transcript) is throttled through rAF and lives in its own context
 * so pages registering commands are not re-rendered while the user speaks.
 */

const STORAGE_KEY = "jobeasy.voiceControl.enabled";

/** Ignore commands for this long after our own speech feedback ends. */
const SELF_ECHO_GRACE_MS = 220;
/** The same utterance heard twice inside this window runs only once. */
const DUPLICATE_WINDOW_MS = 1200;
/** Near-verbatim interim results fire this early instead of waiting for the final. */
const INTERIM_MIN_SCORE = 0.95;
const INTERIM_STABLE_MS = 320;
/** How long feedback stays on the indicator. */
const FEEDBACK_TTL_MS = 4500;

/** Labels we refuse to auto-click unless the user says the dangerous word. */
const DESTRUCTIVE_LABEL_RE = /\b(delete|remove|reject|revoke|discard|destroy|reset)\b/i;

const noop = () => {};

/* Split contexts: consumers that only register commands never re-render when
   the transcript changes. */
const VoiceActionsContext = createContext(null);
const VoiceStatusContext = createContext(null);

function readStoredEnabled() {
  if (typeof window === "undefined") return false;
  try {
    // Default OFF: the microphone only starts once the user asks for it.
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function persistEnabled(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    /* storage unavailable — the toggle still works for this session */
  }
}

export function VoiceControlProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [enabled, setEnabled] = useState(readStoredEnabled);
  const [lastHeard, setLastHeard] = useState("");
  const [feedback, setFeedback] = useState({ text: "", tone: "idle" });

  const pageCommandsRef = useRef([]);
  const globalCommandsRef = useRef([]);
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const speakingUntilRef = useRef(0);
  const lastExecutedRef = useRef({ key: "", at: 0 });
  const interimRef = useRef({ text: "", at: 0, timer: null });
  const heardFrameRef = useRef(0);
  const pendingHeardRef = useRef("");
  const feedbackTimerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* ---------------------------------------------------------------- speech */

  const speak = useCallback((text) => {
    if (!text || typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.12; // brisk: feedback should not outlast the action
      utterance.volume = 0.9;

      // Suppress matching while we talk so the mic does not hear us.
      const estimate = Math.min(400 + text.length * 55, 4000);
      speakingUntilRef.current = Date.now() + estimate;
      utterance.onend = () => {
        speakingUntilRef.current = Date.now() + SELF_ECHO_GRACE_MS;
      };
      utterance.onerror = () => {
        speakingUntilRef.current = 0;
      };

      synth.cancel(); // never queue stale replies
      synth.speak(utterance);
    } catch {
      speakingUntilRef.current = 0;
    }
  }, []);

  /* ------------------------------------------------- throttled UI updates  */

  // Interim transcripts arrive many times per second. Coalesce them into one
  // paint so React never becomes the bottleneck in the matching path.
  const pushHeard = useCallback((text) => {
    pendingHeardRef.current = text;
    if (heardFrameRef.current) return;

    const flush = () => {
      heardFrameRef.current = 0;
      if (mountedRef.current) setLastHeard(pendingHeardRef.current);
    };

    heardFrameRef.current =
      typeof window !== "undefined" && window.requestAnimationFrame
        ? window.requestAnimationFrame(flush)
        : setTimeout(flush, 60);
  }, []);

  const pushFeedback = useCallback((text, tone = "info") => {
    if (!mountedRef.current) return;
    setFeedback({ text, tone });
    clearTimeout(feedbackTimerRef.current);
    if (text) {
      feedbackTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setFeedback({ text: "", tone: "idle" });
      }, FEEDBACK_TTL_MS);
    }
  }, []);

  /* -------------------------------------------------------- enable / mute  */

  const setEnabledPersisted = useCallback((value) => {
    setEnabled((previous) => {
      const next = typeof value === "function" ? value(previous) : value;
      if (next !== previous) persistEnabled(next);
      return next;
    });
  }, []);

  const toggleEnabled = useCallback(() => {
    setEnabledPersisted((previous) => !previous);
  }, [setEnabledPersisted]);

  /* --------------------------------------------------- page registrations  */

  /** Pages call this to add commands that live only while they are mounted. */
  const registerCommands = useCallback((commands) => {
    if (!Array.isArray(commands) || !commands.length) return noop;
    const entries = commands.filter(Boolean);
    pageCommandsRef.current = [...pageCommandsRef.current, ...entries];
    return () => {
      pageCommandsRef.current = pageCommandsRef.current.filter(
        (command) => !entries.includes(command)
      );
    };
  }, []);

  /* -------------------------------------------------------------- registry */

  // Built once. `navigate` is read through a ref so this never has to rebuild,
  // which keeps the compiled-pattern cache warm between renders.
  useEffect(() => {
    const go = (path, options) => () => navigateRef.current(path, options);

    globalCommandsRef.current = [
      /* ── Admin panel: sidebar links, page headings and quick actions ───── */
      {
        id: "admin-dashboard",
        label: "Admin Dashboard",
        patterns: [
          "admin dashboard",
          "admin panel",
          "admin",
          "admin home",
          "administrator dashboard",
        ],
        run: go("/admin/dashboard"),
        feedback: "Opening Admin Dashboard.",
      },
      {
        // Generic: the whole Approval Requests page, unfiltered.
        id: "admin-requests",
        label: "Approval Requests",
        patterns: [
          "approval requests",
          "approval request",
          "requests",
          "admin requests",
          "review requests",
          "view requests",
          "all requests",
        ],
        run: go("/admin/requests"),
        feedback: "Opening Approval Requests.",
      },
      {
        // Quick-action card "Review Pending Requests" + the "Pending Requests"
        // stat card, both of which deep-link to the pending filter.
        // Patterns must not overlap with `admin-requests` above.
        id: "admin-requests-pending",
        label: "Review Pending Requests",
        patterns: [
          "review pending requests",
          "pending requests",
          "pending approval requests",
          "review now",
          "pending",
        ],
        run: go("/admin/requests?status=pending"),
        feedback: "Opening pending requests.",
      },
      {
        id: "admin-requests-rejected",
        label: "Rejected Requests",
        patterns: ["rejected requests", "rejected"],
        run: go("/admin/requests?status=rejected"),
        feedback: "Showing rejected requests.",
      },
      {
        id: "admin-users",
        label: "User Management",
        patterns: [
          "user management",
          "manage users",
          "users",
          "admin users",
          "total users",
          "user list",
          "all users",
        ],
        run: go("/admin/users"),
        feedback: "Opening User Management.",
      },
      {
        id: "admin-users-visitors",
        label: "Visitors",
        patterns: ["visitors", "visitor users", "show visitors"],
        run: go("/admin/users?role=visitor"),
        feedback: "Showing visitors.",
      },
      {
        id: "admin-users-customers",
        label: "Customers",
        patterns: ["customers", "customer users", "show customers"],
        run: go("/admin/users?role=customer"),
        feedback: "Showing customers.",
      },
      {
        id: "admin-default-templates",
        label: "Default Templates",
        patterns: [
          "default templates",
          "manage default templates",
          "manage defaults",
          "admin templates",
          "system templates",
        ],
        run: go("/admin/default-templates"),
        feedback: "Opening Default Templates.",
      },

      /* ── Web app: sidebar links, quick cards and page headings ─────────── */
      {
        id: "app-templates",
        label: "Templates",
        patterns: [
          "templates",
          "my templates",
          "dashboard",
          "template dashboard",
          "template gallery",
          "all templates",
        ],
        run: go("/app/templates"),
        feedback: "Opening Templates.",
      },
      {
        id: "app-new-template",
        label: "New Template",
        patterns: [
          "new template",
          "create template",
          "create new template",
          "add a template",
          "add template",
          "make a template",
          "upload cv",
          "upload template",
        ],
        run: go("/app/new"),
        feedback: "Opening New Template.",
      },
      {
        id: "app-view-templates",
        label: "View Templates",
        patterns: ["view templates", "browse templates", "view template", "preview templates"],
        run: go("/app/view"),
        feedback: "Opening View Templates.",
      },
      {
        id: "app-send-email",
        label: "Send Email",
        patterns: [
          "send email",
          "send an email",
          "send an application",
          "send application",
          "send",
        ],
        run: go("/app/send"),
        feedback: "Opening Send Email.",
      },
      {
        id: "app-update-template",
        label: "Update Template",
        patterns: ["update template", "edit template", "patch template", "update"],
        run: go("/app/update"),
        feedback: "Opening Update Template.",
      },
      {
        id: "app-request-access",
        label: "Request Access",
        patterns: [
          "request access",
          "request email automation access",
          "ask for access",
          "apply for access",
        ],
        run: go("/app/request-access"),
        feedback: "Opening Request Access.",
      },
      {
        id: "app-request-status",
        label: "Request Status",
        patterns: ["request status", "my request status", "approval status"],
        run: go("/app/request-status"),
        feedback: "Opening Request Status.",
      },

      /* ── Public pages & session ───────────────────────────────────────── */
      {
        id: "home",
        label: "Home",
        patterns: ["home", "jobeasy home", "start page", "main page"],
        run: go("/"),
        feedback: "Opening home.",
      },
      {
        id: "features",
        label: "Features",
        patterns: ["features", "feature section"],
        run: () => scrollToSection("features", navigateRef.current),
        feedback: "Showing features.",
      },
      {
        id: "how-it-works",
        label: "How it works",
        patterns: ["how it works", "how does it work"],
        run: () => scrollToSection("how", navigateRef.current),
        feedback: "Showing how it works.",
      },
      {
        id: "login",
        label: "Login",
        patterns: ["login", "login page", "login as admin", "login as customer"],
        run: go("/login"),
        feedback: "Opening Login.",
      },
      {
        id: "register",
        label: "Register",
        patterns: ["register", "register page", "signup page"],
        run: go("/signup"),
        feedback: "Opening Register.",
      },
      {
        id: "logout",
        label: "Logout",
        patterns: ["logout", "log me out", "end my session"],
        minScore: STRICT_MIN_SCORE, // never trigger a session end on a fuzzy guess
        allowInterim: false, // and never on a provisional transcript
        run: () => {
          logout();
          navigateRef.current("/login", { replace: true });
        },
        feedback: "Logging you out.",
      },

      /* ── Browser / voice control itself ───────────────────────────────── */
      {
        id: "go-back",
        label: "Go back",
        patterns: ["back", "previous page", "go back"],
        run: () => navigateRef.current(-1),
        feedback: "Going back.",
      },
      {
        id: "go-forward",
        label: "Go forward",
        patterns: ["forward", "next page", "go forward"],
        run: () => navigateRef.current(1),
        feedback: "Going forward.",
      },
      {
        id: "reload",
        label: "Reload page",
        patterns: ["reload page", "refresh page", "reload this page"],
        allowInterim: false, // discards unsaved page state
        run: () => window.location.reload(),
        feedback: "Reloading.",
      },
      {
        id: "scroll-down",
        label: "Scroll down",
        patterns: ["scroll down", "page down"],
        run: () => window.scrollBy({ top: window.innerHeight * 0.8, behavior: "smooth" }),
      },
      {
        id: "scroll-up",
        label: "Scroll up",
        patterns: ["scroll up", "page up"],
        run: () => window.scrollBy({ top: -window.innerHeight * 0.8, behavior: "smooth" }),
      },
      {
        id: "scroll-top",
        label: "Scroll to top",
        patterns: ["scroll to top", "top of page", "back to top"],
        run: () => window.scrollTo({ top: 0, behavior: "smooth" }),
      },
      {
        id: "mute",
        label: "Stop listening",
        patterns: ["stop listening", "mute", "turn off voice control", "voice off", "stop voice"],
        minScore: STRICT_MIN_SCORE,
        allowInterim: false, // requires a click to undo, so wait for the final
        run: () => setEnabledPersisted(false),
        feedback: "Voice control off.",
      },
    ];
  }, [setEnabledPersisted]);

  /* ------------------------------------------------------------- matching  */

  const runCommand = useCallback(
    (command, meta) => {
      try {
        command.run?.(meta);
      } catch (runError) {
        console.error("[voice] command failed:", command.id || command.label, runError);
        pushFeedback("That command failed. Please try again.", "error");
        return;
      }

      const text = command.feedback || `${command.label || "Done"}.`;
      pushFeedback(text, "success");
      if (command.speak !== false) speak(text);
    },
    [pushFeedback, speak]
  );

  /**
   * Runs the best interpretation of `phrase`.
   * Tier 1: registered commands (page-specific first, then global).
   * Tier 2: any clickable element whose visible label matches.
   * Tier 3: relaxed re-match of the registry.
   * Tier 4: honest "not recognised" feedback with suggestions.
   *
   * @returns {boolean} whether something was executed
   */
  const execute = useCallback(
    (parsed, { strict } = {}) => {
      const all = [...pageCommandsRef.current, ...globalCommandsRef.current];
      // Interim transcripts are provisional — "log out" can appear as a prefix
      // of a longer sentence. Irreversible commands always wait for the final.
      const commands = strict ? all.filter((command) => command.allowInterim !== false) : all;
      const minScore = strict ? INTERIM_MIN_SCORE : DEFAULT_MIN_SCORE;

      const hit = matchCommand(parsed, commands, { minScore });
      if (hit) {
        runCommand(hit.command, { score: hit.score, phrase: parsed.normalized });
        return true;
      }

      // Tier 2 — click what is on the screen right now, by its visible label.
      const target = matchUiTarget(parsed, {
        minScore: strict ? INTERIM_MIN_SCORE : DEFAULT_UI_MIN_SCORE,
      });
      if (target && isSafeToClick(target.label, parsed.normalized)) {
        try {
          target.element.focus?.({ preventScroll: true });
          target.element.click();
          const label = target.label.trim();
          pushFeedback(`Clicked ${label}.`, "success");
          speak(`Opening ${label}.`);
          return true;
        } catch (clickError) {
          console.error("[voice] click failed:", clickError);
        }
      }

      if (strict) return false;

      // Tier 3 — relaxed pass for a partially heard phrase. Gated on an
      // explicit command verb ("open …", "go to …"): the mic is always live,
      // and at this threshold ungated matching fires on ordinary conversation.
      if (parsed.hasCommandIntent) {
        const loose = matchCommand(parsed, commands, { minScore: FALLBACK_MIN_SCORE });
        if (loose) {
          runCommand(loose.command, { score: loose.score, phrase: parsed.normalized, fuzzy: true });
          return true;
        }
      }

      // Tier 4 — never hang. Report back, but only when the user was plainly
      // talking to the app: with an always-on mic, every overheard sentence
      // would otherwise flash "not recognised" at them.
      if (parsed.hasCommandIntent || parsed.forms[0]?.tokens.length <= 4) {
        const suggestions = suggestCommands(parsed, commands, 2);
        if (suggestions.length) {
          pushFeedback(`Didn't match. Did you mean "${suggestions.join('" or "')}"?`, "warn");
        } else {
          pushFeedback(`Not recognised: "${parsed.normalized}"`, "warn");
        }
      }
      return false;
    },
    [pushFeedback, runCommand, speak]
  );

  const clearInterimTimer = useCallback(() => {
    if (interimRef.current.timer) {
      clearTimeout(interimRef.current.timer);
      interimRef.current.timer = null;
    }
  }, []);

  /**
   * Stable speech callback. Never re-created, so `useSpeechRecognition` keeps
   * one recognizer alive for the whole session.
   */
  const handleResult = useCallback(
    ({ transcript, isFinal, alternatives }) => {
      if (!transcript) return;

      pushHeard(transcript);

      // Ignore our own synthesized feedback coming back through the mic.
      if (Date.now() < speakingUntilRef.current) return;

      if (!isFinal) {
        // Fast path: act on a near-verbatim interim once it stops changing,
        // so common commands fire before the engine finalises the sentence.
        const text = normalize(transcript);
        if (!text || text === interimRef.current.text) return;
        interimRef.current.text = text;
        clearInterimTimer();
        interimRef.current.timer = setTimeout(() => {
          interimRef.current.timer = null;
          if (Date.now() < speakingUntilRef.current) return;
          const parsed = parsePhrase(text);
          if (isDuplicate(lastExecutedRef, parsed.normalized)) return;
          if (execute(parsed, { strict: true })) {
            markExecuted(lastExecutedRef, parsed.normalized);
          }
        }, INTERIM_STABLE_MS);
        return;
      }

      clearInterimTimer();
      interimRef.current.text = "";

      const parsed = parsePhrase(transcript);
      if (!parsed.normalized) return;
      if (isDuplicate(lastExecutedRef, parsed.normalized)) return;

      markExecuted(lastExecutedRef, parsed.normalized);
      if (execute(parsed)) return;

      // Last resort: the engine's alternative guesses (mis-heard words).
      for (const alternative of alternatives || []) {
        const candidate = parsePhrase(alternative);
        if (!candidate.normalized || candidate.normalized === parsed.normalized) continue;
        if (execute(candidate, { strict: true })) {
          markExecuted(lastExecutedRef, candidate.normalized);
          return;
        }
      }
    },
    [clearInterimTimer, execute, pushHeard]
  );

  const handleError = useCallback(
    (kind) => {
      if (kind === "not-allowed" || kind === "service-not-allowed") {
        pushFeedback("Microphone blocked. Allow mic access in your browser.", "error");
        setEnabledPersisted(false);
      }
    },
    [pushFeedback, setEnabledPersisted]
  );

  /* ------------------------------------------------------------------ auth */

  useEffect(() => {
    let active = true;

    const checkAdmin = async () => {
      const token = getAccessToken();
      if (!token) {
        if (active) {
          setIsAdmin(false);
          setAuthLoading(false);
        }
        return;
      }
      try {
        const user = await getCurrentUser();
        if (active) setIsAdmin(user?.role === "admin");
      } catch {
        if (active) setIsAdmin(false);
      } finally {
        if (active) setAuthLoading(false);
      }
    };

    checkAdmin();
    window.addEventListener("storage", checkAdmin);
    return () => {
      active = false;
      window.removeEventListener("storage", checkAdmin);
    };
  }, [location.pathname]);

  /* ------------------------------------------------------------ recognition */

  const shouldListen = isAdmin && enabled && !authLoading;

  const { isListening, isSupported, error } = useSpeechRecognition({
    onResult: handleResult,
    onError: handleError,
    enabled: shouldListen,
  });

  // Reset transient UI state whenever the mic goes quiet.
  useEffect(() => {
    if (shouldListen) return;
    clearInterimTimer();
    interimRef.current.text = "";
    pendingHeardRef.current = "";
    setLastHeard("");
  }, [shouldListen, clearInterimTimer]);

  useEffect(
    () => () => {
      clearTimeout(feedbackTimerRef.current);
      if (interimRef.current.timer) clearTimeout(interimRef.current.timer);
      if (heardFrameRef.current && typeof window !== "undefined" && window.cancelAnimationFrame) {
        window.cancelAnimationFrame(heardFrameRef.current);
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          /* nothing to cancel */
        }
      }
    },
    []
  );

  /* --------------------------------------------------------------- context */

  // Stable: identity only changes when a genuinely stable callback changes,
  // so pages registering commands never re-render because of speech activity.
  const actions = useMemo(
    () => ({ registerCommands, toggleEnabled, setEnabled: setEnabledPersisted, speak }),
    [registerCommands, toggleEnabled, setEnabledPersisted, speak]
  );

  const status = useMemo(
    () => ({
      enabled,
      active: shouldListen,
      isListening: shouldListen && isListening,
      isSupported,
      lastHeard,
      lastFeedback: feedback.text,
      feedbackTone: feedback.tone,
      error,
      isAdmin,
      authLoading,
    }),
    [enabled, shouldListen, isListening, isSupported, lastHeard, feedback, error, isAdmin, authLoading]
  );

  return (
    <VoiceActionsContext.Provider value={actions}>
      <VoiceStatusContext.Provider value={status}>{children}</VoiceStatusContext.Provider>
    </VoiceActionsContext.Provider>
  );
}

/* -------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------- */

function isDuplicate(ref, key) {
  const { key: previous, at } = ref.current;
  return key === previous && Date.now() - at < DUPLICATE_WINDOW_MS;
}

function markExecuted(ref, key) {
  ref.current = { key, at: Date.now() };
}

/** Destructive controls need the user to actually say the dangerous word. */
function isSafeToClick(label, phrase) {
  if (!DESTRUCTIVE_LABEL_RE.test(label)) return true;
  const match = label.match(DESTRUCTIVE_LABEL_RE);
  return match ? phrase.includes(match[0].toLowerCase()) : false;
}

/** Landing-page anchors: scroll if present, otherwise route home first. */
function scrollToSection(id, navigateFn) {
  const target = typeof document !== "undefined" ? document.getElementById(id) : null;
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  navigateFn(`/#${id}`);
}

/* -------------------------------------------------------------------------
 * Hooks
 * ---------------------------------------------------------------------- */

/** Full voice state + actions. Re-renders while the user speaks. */
export function useVoiceControl() {
  const status = useContext(VoiceStatusContext);
  const actions = useContext(VoiceActionsContext);
  if (!status || !actions) {
    throw new Error("useVoiceControl must be used within a VoiceControlProvider");
  }
  return useMemo(() => ({ ...status, ...actions }), [status, actions]);
}

/** Actions only — stable identity, safe for components that must not re-render. */
export function useVoiceActions() {
  const actions = useContext(VoiceActionsContext);
  if (!actions) {
    throw new Error("useVoiceActions must be used within a VoiceControlProvider");
  }
  return actions;
}

/**
 * Registers page-scoped voice commands for as long as the component is mounted.
 *
 * @example
 * useVoiceCommands([
 *   { label: "Refresh", patterns: ["refresh", "reload templates"], run: fetchData },
 * ]);
 */
export function useVoiceCommands(commands) {
  const { registerCommands } = useVoiceActions();
  const commandsRef = useRef(commands);
  commandsRef.current = commands;

  // Re-register only when the vocabulary itself changes — not when a page
  // re-renders with new closures.
  const key = useMemo(() => {
    if (!Array.isArray(commands)) return "";
    return commands
      .map((command) => `${command?.label || ""}|${(command?.patterns || []).join(",")}`)
      .join(";");
  }, [commands]);

  useEffect(() => {
    const list = Array.isArray(commandsRef.current) ? commandsRef.current : [];
    if (!list.length) return undefined;

    // Proxy entries: patterns are frozen for the registration, while `run` and
    // `feedback` always resolve against the latest render.
    const wrapped = list.map((command, index) => ({
      id: command.id,
      label: command.label,
      patterns: command.patterns,
      minScore: command.minScore,
      get feedback() {
        return commandsRef.current?.[index]?.feedback;
      },
      run: (...args) => commandsRef.current?.[index]?.run?.(...args),
    }));

    return registerCommands(wrapped);
  }, [registerCommands, key]);
}
