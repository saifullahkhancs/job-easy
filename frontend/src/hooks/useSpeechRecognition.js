import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useSpeechRecognition — continuous, low-latency wrapper around the browser's
 * native SpeechRecognition API (window.SpeechRecognition / webkitSpeechRecognition).
 *
 * 100% free, no API key: the engine ships with the browser. Chrome/Edge have
 * the best support; Safari/Firefox vary, so always check `isSupported`.
 *
 * Responsiveness notes (this is where the old version stalled):
 *  - Results are delivered straight from the `onresult` event via a ref, so a
 *    React re-render can never sit between the transcript and the handler.
 *  - Only *new* results (from `event.resultIndex` onwards) are read, instead of
 *    re-reading the whole accumulating result list on every event.
 *  - The engine stops itself every ~30-60s (and on every silence timeout).
 *    We restart on the next macrotask instead of after a fixed delay, so the
 *    dead-air window between sessions is imperceptible.
 *  - Restart failures back off exponentially and fatal states (mic permission
 *    denied) stop the loop entirely. The old code restarted unconditionally,
 *    which produced a start/error/end storm that froze the tab.
 *  - `isListening` is only pushed into React state when it actually flips.
 *
 * @param {Object} options
 * @param {(result: {transcript: string, isFinal: boolean, alternatives: string[], confidence: number}) => void} options.onResult
 * @param {(error: string) => void} [options.onError]
 * @param {boolean} options.enabled - master switch; false stops the mic completely
 * @param {string} [options.lang="en-US"] - BCP-47 language tag
 * @param {boolean} [options.interimResults=true]
 * @param {number} [options.maxAlternatives=3] - extra guesses improve fuzzy matching
 */
export function useSpeechRecognition({
  onResult,
  onError,
  enabled,
  lang = "en-US",
  interimResults = true,
  maxAlternatives = 3,
}) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const shouldRunRef = useRef(false);
  const startingRef = useRef(false);
  const listeningRef = useRef(false);
  const restartTimerRef = useRef(null);
  const watchdogRef = useRef(null);
  const failureCountRef = useRef(0);
  const lastResultAtRef = useRef(0);
  const fatalRef = useRef(false);

  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  const startRef = useRef(null);

  // Keep the callbacks fresh without ever rebuilding the recognizer.
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const SpeechRecognitionCtor =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;
  const isSupported = Boolean(SpeechRecognitionCtor);

  /** State setter that no-ops when the value is unchanged (avoids re-renders). */
  const setListening = useCallback((next) => {
    if (listeningRef.current === next) return;
    listeningRef.current = next;
    setIsListening(next);
  }, []);

  const clearTimers = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  /** Detach handlers so a discarded instance can never resurrect the loop. */
  const teardown = useCallback((instance) => {
    if (!instance) return;
    instance.onresult = null;
    instance.onerror = null;
    instance.onend = null;
    instance.onstart = null;
    instance.onaudiostart = null;
    instance.onspeechend = null;
    try {
      instance.abort();
    } catch {
      /* already dead */
    }
  }, []);

  const scheduleRestart = useCallback(
    (delay) => {
      if (!shouldRunRef.current || fatalRef.current) return;
      clearTimers();
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        startRef.current?.();
      }, delay);
    },
    [clearTimers]
  );

  const start = useCallback(() => {
    if (!isSupported) {
      setError("not-supported");
      return;
    }
    if (!shouldRunRef.current || fatalRef.current) return;
    // Already running or mid-handshake — starting twice throws InvalidStateError.
    if (recognitionRef.current || startingRef.current) return;

    let recognition;
    try {
      recognition = new SpeechRecognitionCtor();
    } catch {
      scheduleRestart(1000);
      return;
    }

    recognition.continuous = true;
    recognition.interimResults = interimResults;
    recognition.lang = lang;
    try {
      recognition.maxAlternatives = maxAlternatives;
    } catch {
      /* not all engines expose this */
    }

    recognition.onstart = () => {
      startingRef.current = false;
      failureCountRef.current = 0;
      lastResultAtRef.current = Date.now();
      setListening(true);
      setError(null);
    };

    recognition.onaudiostart = () => {
      lastResultAtRef.current = Date.now();
    };

    // Hot path: keep it allocation-light and synchronous.
    recognition.onresult = (event) => {
      lastResultAtRef.current = Date.now();
      const handler = onResultRef.current;
      if (!handler) return;

      const results = event.results;
      // Only look at what arrived in THIS event — the list is cumulative.
      for (let i = event.resultIndex; i < results.length; i += 1) {
        const result = results[i];
        if (!result || !result[0]) continue;

        const transcript = result[0].transcript.trim();
        if (!transcript) continue;

        let alternatives;
        if (result.isFinal && result.length > 1) {
          alternatives = [];
          for (let a = 1; a < result.length; a += 1) {
            const alt = result[a]?.transcript?.trim();
            if (alt) alternatives.push(alt);
          }
        }

        try {
          handler({
            transcript,
            isFinal: Boolean(result.isFinal),
            alternatives: alternatives || [],
            confidence: typeof result[0].confidence === "number" ? result[0].confidence : 0,
          });
        } catch {
          /* a throwing consumer must never kill the recognition loop */
        }
      }
    };

    recognition.onerror = (event) => {
      const kind = event?.error || "unknown";
      startingRef.current = false;

      // Permission problems are terminal: retrying spams the browser and
      // locks up the tab. Surface them and stand down until re-enabled.
      if (kind === "not-allowed" || kind === "service-not-allowed") {
        fatalRef.current = true;
        shouldRunRef.current = false;
        setError(kind);
        onErrorRef.current?.(kind);
        return;
      }

      // Routine during always-on listening (silence, tab switch, our own stop).
      if (kind === "no-speech" || kind === "aborted") return;

      failureCountRef.current += 1;
      setError(kind);
      onErrorRef.current?.(kind);
    };

    recognition.onend = () => {
      startingRef.current = false;
      setListening(false);
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;

      if (!shouldRunRef.current || fatalRef.current) return;

      // Normal end (engine timeout) → restart on the next macrotask so the
      // gap is unnoticeable. Repeated failures → exponential backoff.
      const failures = failureCountRef.current;
      scheduleRestart(failures === 0 ? 0 : Math.min(200 * 2 ** (failures - 1), 4000));
    };

    startingRef.current = true;
    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      // Usually "already started" from a racing instance — recycle and retry.
      startingRef.current = false;
      teardown(recognition);
      failureCountRef.current += 1;
      scheduleRestart(Math.min(200 * 2 ** failureCountRef.current, 4000));
    }
  }, [
    SpeechRecognitionCtor,
    isSupported,
    lang,
    interimResults,
    maxAlternatives,
    scheduleRestart,
    setListening,
    teardown,
  ]);

  startRef.current = start;

  const stop = useCallback(() => {
    shouldRunRef.current = false;
    clearTimers();
    const instance = recognitionRef.current;
    recognitionRef.current = null;
    startingRef.current = false;
    teardown(instance);
    setListening(false);
  }, [clearTimers, setListening, teardown]);

  /** Force a fresh session (used after a fatal error is cleared). */
  const restart = useCallback(() => {
    fatalRef.current = false;
    failureCountRef.current = 0;
    setError(null);
    const instance = recognitionRef.current;
    recognitionRef.current = null;
    teardown(instance);
    if (shouldRunRef.current) scheduleRestart(0);
  }, [scheduleRestart, teardown]);

  // Master on/off switch.
  useEffect(() => {
    if (enabled) {
      fatalRef.current = false;
      failureCountRef.current = 0;
      shouldRunRef.current = true;
      setError(null);
      start();
    } else {
      stop();
      setError(null);
    }
    return () => stop();
  }, [enabled, start, stop]);

  // Watchdog: some engines end without firing `onend` (backgrounded tab,
  // suspended audio track). Poll cheaply and revive a stalled session.
  useEffect(() => {
    if (!enabled || !isSupported) return undefined;

    watchdogRef.current = setInterval(() => {
      if (!shouldRunRef.current || fatalRef.current) return;
      if (typeof document !== "undefined" && document.hidden) return;

      const idle = Date.now() - lastResultAtRef.current;
      if (!recognitionRef.current && !startingRef.current && !restartTimerRef.current) {
        startRef.current?.();
      } else if (listeningRef.current && idle > 25000) {
        // Alive on paper but deaf for 25s — cycle it.
        lastResultAtRef.current = Date.now();
        const instance = recognitionRef.current;
        recognitionRef.current = null;
        teardown(instance);
        scheduleRestart(0);
      }
    }, 4000);

    return () => {
      clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    };
  }, [enabled, isSupported, scheduleRestart, teardown]);

  // Browsers pause recognition for hidden tabs; resume the moment we're back.
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return undefined;

    const handleVisibility = () => {
      if (document.hidden || !shouldRunRef.current || fatalRef.current) return;
      lastResultAtRef.current = Date.now();
      if (!recognitionRef.current && !startingRef.current) scheduleRestart(0);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [enabled, scheduleRestart]);

  return { isListening, isSupported, error, restart };
}
