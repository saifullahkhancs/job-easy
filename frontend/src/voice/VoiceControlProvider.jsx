import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { extractCommandAfterWakeWord, matchCommand, normalize } from "./commandMatching";
import { getCurrentUser, logout } from "../api/client";
import { getAccessToken } from "../api/tokenStorage";

const VoiceControlContext = createContext(null);

/** How long (ms) we stay "awake" after the wake word before requiring it again. */
const AWAKE_WINDOW_MS = 6000;

const STORAGE_KEY = "jobeasy.voiceControl.enabled";

function speak(text) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    window.speechSynthesis.cancel(); // don't queue up stale replies
    window.speechSynthesis.speak(utterance);
  } catch {
    /* speech synthesis unavailable - fail silently, indicator still shows text */
  }
}

export function VoiceControlProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "true";
  });
  const [isAwake, setIsAwake] = useState(false);
  const [lastHeard, setLastHeard] = useState("");
  const [lastFeedback, setLastFeedback] = useState("");

  const awakeTimeoutRef = useRef(null);
  const pageCommandsRef = useRef([]); // commands registered by the current page

  // Check if current user is admin
  useEffect(() => {
    let isMounted = true;
    const checkAdmin = async () => {
      const token = getAccessToken();
      if (!token) {
        if (isMounted) {
          setIsAdmin(false);
          setAuthLoading(false);
        }
        return;
      }
      try {
        const user = await getCurrentUser();
        if (isMounted) {
          setIsAdmin(user?.role === "admin");
        }
      } catch {
        if (isMounted) {
          setIsAdmin(false);
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    };

    checkAdmin();

    const handleStorageChange = () => {
      checkAdmin();
    };
    window.addEventListener("storage", handleStorageChange);
    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [location.pathname]);

  const wakeUp = useCallback(() => {
    setIsAwake(true);
    clearTimeout(awakeTimeoutRef.current);
    awakeTimeoutRef.current = setTimeout(() => setIsAwake(false), AWAKE_WINDOW_MS);
  }, []);

  /** Pages call this to add their own commands, active only while mounted. */
  const registerCommands = useCallback((commands) => {
    pageCommandsRef.current = [...pageCommandsRef.current, ...commands];
    return () => {
      pageCommandsRef.current = pageCommandsRef.current.filter((c) => !commands.includes(c));
    };
  }, []);

  const globalCommands = useMemo(
    () => [
      // Admin navigation & actions
      {
        patterns: ["go to admin dashboard", "admin dashboard", "open admin"],
        run: () => navigate("/admin/dashboard"),
        feedback: "Opening admin dashboard.",
      },
      {
        patterns: ["approval requests", "view requests", "open requests", "admin requests"],
        run: () => navigate("/admin/requests"),
        feedback: "Opening approval requests.",
      },
      {
        patterns: ["user management", "manage users", "open users", "admin users"],
        run: () => navigate("/admin/users"),
        feedback: "Opening user management.",
      },
      {
        patterns: ["default templates", "manage default templates", "admin templates"],
        run: () => navigate("/admin/default-templates"),
        feedback: "Opening default templates.",
      },
      // Web / App navigation & actions
      {
        patterns: ["go to dashboard", "go to templates", "show my templates", "go home"],
        run: () => navigate("/app/templates"),
        feedback: "Opening templates.",
      },
      {
        patterns: ["create template", "new template", "make a template"],
        run: () => navigate("/app/new"),
        feedback: "Let's create a new template.",
      },
      {
        patterns: ["go to send", "open send page", "send an email"],
        run: () => navigate("/app/send"),
        feedback: "Opening send.",
      },
      {
        patterns: ["go to view", "open view page"],
        run: () => navigate("/app/view"),
        feedback: "Opening view.",
      },
      {
        patterns: ["go to update", "open update page"],
        run: () => navigate("/app/update"),
        feedback: "Opening update.",
      },
      {
        patterns: ["request access"],
        run: () => navigate("/app/request-access"),
        feedback: "Opening request access.",
      },
      {
        patterns: ["go to login", "log me in", "open login"],
        run: () => navigate("/login"),
        feedback: "Opening login.",
      },
      {
        patterns: ["go back"],
        run: () => navigate(-1),
        feedback: "Going back.",
      },
      {
        patterns: ["log out", "sign out"],
        run: () => {
          logout();
          navigate("/login", { replace: true });
        },
        feedback: "Logging you out.",
      },
      {
        patterns: ["stop listening", "go to sleep", "mute"],
        run: () => setEnabled(false),
        feedback: "Voice control off. Say 'hy jarvis' to turn it back on.",
      },
    ],
    [navigate]
  );

  const handlePhrase = useCallback(
    (phrase) => {
      const allCommands = [...pageCommandsRef.current, ...globalCommands];
      const command = matchCommand(phrase, allCommands);
      if (command) {
        command.run();
        setLastFeedback(command.feedback || "Done.");
        if (command.feedback) speak(command.feedback);
      } else if (phrase.length > 0) {
        setLastFeedback(`Didn't recognize: "${phrase}"`);
      }
    },
    [globalCommands]
  );

  const handleResult = useCallback(
    (text, isFinal) => {
      setLastHeard(text);
      const normalized = normalize(text);

      if (!isAwake) {
        const command = extractCommandAfterWakeWord(normalized);
        if (command === null) return; // wake word not heard yet
        wakeUp();
        if (command.length > 0 && isFinal) {
          handlePhrase(command);
        }
        return;
      }

      // Already awake: treat the whole final phrase as a command,
      // and refresh the awake window so a pause doesn't cut it off mid-sentence.
      wakeUp();
      if (isFinal) {
        handlePhrase(normalized);
      }
    },
    [isAwake, wakeUp, handlePhrase]
  );

  // Active ONLY for admin users
  const shouldListen = isAdmin && enabled && !authLoading;

  const { isListening, isSupported, error } = useSpeechRecognition({
    onResult: handleResult,
    enabled: shouldListen,
  });

  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* localStorage unavailable - toggle still works for this session */
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      enabled: shouldListen && enabled,
      toggleEnabled,
      isListening: shouldListen && isListening,
      isSupported,
      isAwake: shouldListen && isAwake,
      lastHeard,
      lastFeedback,
      error,
      isAdmin,
      registerCommands,
    }),
    [shouldListen, enabled, toggleEnabled, isListening, isSupported, isAwake, lastHeard, lastFeedback, error, isAdmin, registerCommands]
  );

  return <VoiceControlContext.Provider value={value}>{children}</VoiceControlContext.Provider>;
}

export function useVoiceControl() {
  const ctx = useContext(VoiceControlContext);
  if (!ctx) {
    throw new Error("useVoiceControl must be used within a VoiceControlProvider");
  }
  return ctx;
}

/**
 * Convenience hook for pages to register their own voice commands.
 */
export function useVoiceCommands(commands) {
  const { registerCommands } = useVoiceControl();
  const commandsRef = useRef(commands);
  commandsRef.current = commands;

  const patternsKey = JSON.stringify(commands.map((c) => c.patterns));

  useEffect(() => {
    const wrapped = commandsRef.current.map((c) => ({
      patterns: c.patterns,
      get feedback() {
        return commandsRef.current.find((rc) => rc.patterns === c.patterns)?.feedback;
      },
      run: (...args) => commandsRef.current.find((rc) => rc.patterns === c.patterns)?.run(...args),
    }));
    return registerCommands(wrapped);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerCommands, patternsKey]);
}
