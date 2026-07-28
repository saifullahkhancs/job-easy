import { Mic, MicOff } from "lucide-react";
import { useVoiceControl } from "./VoiceControlProvider";

/**
 * Floating microphone toggle.
 *
 * One click turns voice control ON (recognition starts listening immediately
 * and continuously — there is no wake word) and another click turns it OFF,
 * which stops the microphone entirely. The choice is persisted.
 */
export default function VoiceIndicator() {
  const {
    enabled,
    toggleEnabled,
    isListening,
    isSupported,
    isAdmin,
    lastHeard,
    lastFeedback,
    feedbackTone,
    error,
  } = useVoiceControl();

  // Admin-only, and only where the browser can actually listen.
  if (!isSupported || !isAdmin) return null;

  const blocked = error === "not-allowed" || error === "service-not-allowed";

  let statusLabel;
  if (blocked) statusLabel = "Microphone blocked";
  else if (!enabled) statusLabel = "Voice control off";
  else if (isListening) statusLabel = "Listening…";
  else statusLabel = "Starting…";

  const buttonTitle = enabled
    ? "Turn voice control off"
    : "Turn voice control on — listens continuously, no wake word";

  const stateClass = blocked
    ? " voice-indicator-error"
    : enabled && isListening
      ? " voice-indicator-live"
      : "";

  return (
    <div
      className={`voice-indicator${enabled ? " voice-indicator-on" : " voice-indicator-off"}`}
      role="status"
      aria-live="polite"
      data-voice-ignore="true"
    >
      <button
        type="button"
        className={`voice-indicator-btn${stateClass}`}
        onClick={toggleEnabled}
        title={buttonTitle}
        aria-label={buttonTitle}
        aria-pressed={enabled}
      >
        {enabled && !blocked ? <Mic size={18} /> : <MicOff size={18} />}
      </button>

      <div className="voice-indicator-text">
        <div className="voice-indicator-status">{statusLabel}</div>
        {enabled && !blocked && lastHeard && (
          <div className="voice-indicator-heard" title={lastHeard}>
            “{lastHeard}”
          </div>
        )}
        {enabled && lastFeedback && (
          <div
            className={`voice-indicator-feedback voice-feedback-${feedbackTone || "info"}`}
            title={lastFeedback}
          >
            {lastFeedback}
          </div>
        )}
        {!enabled && !blocked && (
          <div className="voice-indicator-hint">Click the mic, then say a command</div>
        )}
        {blocked && <div className="voice-indicator-hint">Allow mic access, then click again</div>}
      </div>
    </div>
  );
}
