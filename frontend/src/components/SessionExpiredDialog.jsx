import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, LogIn } from "lucide-react";
import {
  acknowledgeSessionExpired,
  clearStoredSession,
  subscribeSessionExpired,
} from "../api/session";

const FALLBACK_MESSAGE = "Your session has expired. Please log in again to continue.";

export default function SessionExpiredDialog() {
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    return subscribeSessionExpired(({ message: nextMessage }) => {
      setMessage(nextMessage || FALLBACK_MESSAGE);
    });
  }, []);

  const handleLogin = () => {
    clearStoredSession();
    acknowledgeSessionExpired();
    setMessage("");
    navigate("/login", { replace: true });
  };

  if (!message) {
    return null;
  }

  return (
    <div className="session-dialog-backdrop" role="presentation">
      <div
        className="session-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-dialog-title"
        aria-describedby="session-dialog-description"
      >
        <div className="session-dialog-icon">
          <AlertTriangle size={28} />
        </div>
        <div className="session-dialog-content">
          <h2 id="session-dialog-title">Session Expired</h2>
          <p id="session-dialog-description">{message}</p>
        </div>
        <button type="button" className="primary-btn" onClick={handleLogin} autoFocus>
          <LogIn size={18} />
          Log in again
        </button>
      </div>
    </div>
  );
}
