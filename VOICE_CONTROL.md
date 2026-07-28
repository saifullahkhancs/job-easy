# Voice Control Module (Web Speech API) - Job Easy

This document outlines the architecture, usage, and configuration guidelines for the voice control module in **Job Easy**.

---

## 🎙️ Overview

The voice control module utilizes the browser-native **Web Speech API** (`window.SpeechRecognition` / `window.webkitSpeechRecognition` and `window.speechSynthesis`) to provide hands-free navigation and action execution across the application.

- **100% Free / No API Key Required**: Built directly into modern browsers (Chrome, Edge, Safari).
- **Admin-Only Restriction**: The voice control system is available across the admin and web app routes, but **activates only when logged in as an Administrator** (`currentUser?.role === 'admin'`).
- **Wake Word**: Activates upon hearing **"Hy Jarvis"** (plus phonetic variants like *"Hi Jarvis"*, *"Hey Jarvis"*, *"Ok Jarvis"*).

---

## 📂 Module Structure

```text
frontend/src/
├── hooks/
│   └── useSpeechRecognition.js   # Continuous listening wrapper with auto-restart
└── voice/
    ├── commandMatching.js        # Normalization, wake word extraction, and command matching
    ├── VoiceControlProvider.jsx  # Context provider managing awake state, global commands, and auth check
    └── VoiceIndicator.jsx        # Floating microphone UI indicator showing status & feedback
```

---

## ⚙️ How It Works

1. **Role Verification**: `VoiceControlProvider` checks the current user's profile (`getCurrentUser()`). If the user has the `admin` role, speech recognition is enabled. For visitors, customers, guests, or unauthenticated users, voice control remains inactive and the indicator is hidden.
2. **Wake Word Trigger**: While listening, the engine waits for the wake word **"Hy Jarvis"**.
3. **Awake Window**: Once triggered, an active window opens for **6 seconds** (refreshed on each subsequent command), allowing spoken commands without repeating the wake word.
4. **Command Execution**: Spoken phrases are matched against global navigation/action commands or page-registered commands (`useVoiceCommands`), executing routing changes or actions with spoken speech synthesis feedback.
5. **Persistent Mute**: Users can click the floating microphone indicator to toggle voice control on or off (persisted in `localStorage` under `jobeasy.voiceControl.enabled`).

---

## 🛠️ Available Commands

### Global Commands (Admin & Web App)
- **Admin Navigation**:
  - *"Hy Jarvis, go to admin dashboard"* / *"open admin"*
  - *"Hy Jarvis, approval requests"* / *"view requests"*
  - *"Hy Jarvis, user management"* / *"manage users"*
  - *"Hy Jarvis, default templates"*
- **Web App Navigation & Actions**:
  - *"Hy Jarvis, go to dashboard"* / *"go home"*
  - *"Hy Jarvis, create template"* / *"new template"*
  - *"Hy Jarvis, go to send"*
  - *"Hy Jarvis, go to view"*
  - *"Hy Jarvis, go to update"*
  - *"Hy Jarvis, request access"*
  - *"Hy Jarvis, go back"*
  - *"Hy Jarvis, log out"* / *"sign out"*
  - *"Hy Jarvis, stop listening"* / *"mute"* / *"go to sleep"*

### Page-Specific Commands
Pages can register custom commands using `useVoiceCommands`:
```javascript
import { useVoiceCommands } from "../voice/VoiceControlProvider";

// Inside your page component:
useVoiceCommands([
  {
    patterns: ["refresh templates", "reload templates"],
    run: () => fetchData(),
    feedback: "Refreshing templates.",
  },
]);
```

---

## 🚀 Browser Compatibility
- **Full Support**: Google Chrome, Microsoft Edge, Brave (Chromium-based browsers).
- **Limited/Partial**: Safari, Firefox (browser support varies; `useSpeechRecognition` gracefully handles unsupported environments via `isSupported`).
