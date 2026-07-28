import { Mic, MicOff } from "lucide-react";
import { useVoiceControl } from "./VoiceControlProvider";

export default function VoiceIndicator() {
  const { enabled, toggleEnabled, isListening, isSupported, isAwake, lastHeard, lastFeedback, isAdmin } =
    useVoiceControl();

  // Active only for admin users on supported browsers
  if (!isSupported || !isAdmin) return null;

  const statusLabel = !enabled
    ? "Voice control off"
    : isAwake
    ? "Listening for a command…"
    : "Say \u201cHy Jarvis\u201d";

  return (
    <div className="voice-indicator" role="status" aria-live="polite">
      <button
        type="button"
        className={`voice-indicator-btn${isAwake ? " voice-indicator-awake" : ""}`}
        onClick={toggleEnabled}
        title={enabled ? "Turn voice control off" : "Turn voice control on"}
        aria-pressed={enabled}
      >
        {enabled && isListening ? <Mic size={18} /> : <MicOff size={18} />}
      </button>
      <div className="voice-indicator-text">
        <div className="voice-indicator-status">{statusLabel}</div>
        {enabled && lastHeard && <div className="voice-indicator-heard">“{lastHeard}”</div>}
        {enabled && lastFeedback && <div className="voice-indicator-feedback">{lastFeedback}</div>}
      </div>
    </div>
  );
}
