import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Thin wrapper around the browser's native SpeechRecognition API
 * (window.SpeechRecognition / window.webkitSpeechRecognition).
 *
 * This is 100% free and requires no API key - it ships with the browser.
 * Chrome/Edge have the best support; Safari and Firefox support is
 * limited or absent, so `isSupported` must be checked before relying on it.
 *
 * Because we want "always listening", this hook automatically restarts
 * recognition whenever it stops (the browser API only gives you short
 * bursts at a time - it does not stay open indefinitely on its own).
 *
 * @param {Object} options
 * @param {(text: string, isFinal: boolean) => void} options.onResult - called with the recognized text
 * @param {boolean} options.enabled - whether recognition should be running at all
 * @param {string} [options.lang] - BCP-47 language tag, e.g. "en-US"
 */
export function useSpeechRecognition({ onResult, enabled, lang = "en-US" }) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const shouldRunRef = useRef(false);
  const onResultRef = useRef(onResult);

  // Always call the latest onResult without having to recreate the recognizer.
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const SpeechRecognitionCtor =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const isSupported = Boolean(SpeechRecognitionCtor);

  const start = useCallback(() => {
    if (!isSupported) {
      setError("not-supported");
      return;
    }
    shouldRunRef.current = true;

    if (recognitionRef.current) {
      // Already running (or about to be) - avoid double-starting, which throws.
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const text = result[0].transcript.trim();
      onResultRef.current?.(text, result.isFinal);
    };

    recognition.onerror = (event) => {
      // "no-speech" and "aborted" happen constantly during normal always-on
      // use (e.g. silence, tab backgrounded) - they are not real errors.
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setError(event.error);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      // Auto-restart to simulate continuous/always-on listening, since
      // browsers stop recognition periodically on their own.
      if (shouldRunRef.current) {
        setTimeout(() => {
          if (shouldRunRef.current) start();
        }, 250);
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
      setError(null);
    } catch {
      recognitionRef.current = null;
    }
  }, [SpeechRecognitionCtor, isSupported, lang]);

  const stop = useCallback(() => {
    shouldRunRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      start();
    } else {
      stop();
    }
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { isListening, isSupported, error };
}
