# Voice Control Module (Web Speech API) - Job Easy

This document outlines the architecture, usage, and configuration guidelines for the voice control module in **Job Easy**.

---

## 🎙️ Overview

The voice control module utilizes the browser-native **Web Speech API** (`window.SpeechRecognition` / `window.webkitSpeechRecognition` and `window.speechSynthesis`) to provide hands-free navigation and action execution across the application.

- **100% Free / No API Key Required**: Built directly into modern browsers (Chrome, Edge, Safari).
- **Admin-Only Restriction**: The voice control system is available across the admin and web app routes, but **activates only when logged in as an Administrator** (`currentUser?.role === 'admin'`).
- **No Wake Word — Toggle Activation**: There is no *"Hy Jarvis"* state machine. Recognition listens **immediately and continuously** from the moment the user clicks the floating microphone button to turn voice control **ON**. Clicking again turns it **OFF** and stops the microphone entirely. The choice persists in `localStorage` under `jobeasy.voiceControl.enabled` (default: **off** until the user opts in, so the browser never shows an unprompted mic permission dialog).
- **Commands Mirror the UI**: Every command is the text you can actually see on screen — sidebar links, page headings, quick-action cards and button titles.

---

## 📂 Module Structure

```text
frontend/src/
├── hooks/
│   └── useSpeechRecognition.js   # Continuous listening with clean auto-restart & watchdog
└── voice/
    ├── commandMatching.js        # Normalization, fuzzy/substring matching, DOM label matching
    ├── VoiceControlProvider.jsx  # Context provider: command registry, matching pipeline, auth check
    └── VoiceIndicator.jsx        # Floating microphone toggle showing status & feedback
```

---

## ⚙️ How It Works

1. **Role Verification**: `VoiceControlProvider` checks the current user's profile (`getCurrentUser()`). If the user has the `admin` role, voice control becomes available. For visitors, customers, guests, or unauthenticated users, the indicator is hidden and recognition never starts.
2. **Toggle Activation**: The user clicks the floating microphone. Recognition starts instantly and stays open — every utterance is a potential command, with no wake word and no awake/asleep window.
3. **Command Execution**: Each final transcript runs through the matching pipeline (below) and executes a navigation or action, with spoken feedback via speech synthesis.
4. **Mute**: Clicking the microphone again (or saying *"stop listening"*) stops recognition completely and persists the preference.

### Matching Pipeline

Each spoken phrase is tried against four tiers, stopping at the first hit:

| Tier | What it does | Threshold |
| --- | --- | --- |
| 1 | **Registered commands** — page-specific commands first, then the global registry | `0.78` |
| 2 | **On-screen elements** — clicks any visible button/link whose label matches | `0.80` + shared word |
| 3 | **Relaxed fallback** — only when the phrase starts with a command verb (*"open…"*, *"go to…"*, *"click…"*) | `0.62` + shared word |
| 4 | **Feedback** — reports what was heard and suggests the closest commands | — |

Tier 2 is what makes *every* button reachable by voice: labels are read from the live DOM (`aria-label` → `title` → text content), so buttons on any page work without modifying those components. Hidden, disabled and `[data-voice-ignore]` elements are skipped.

Similarity blends **Dice bigrams**, **Levenshtein distance** and **Jaro-Winkler**, so mis-heard words still resolve (*"open user managment"* → **User Management**). Because the microphone is always live, matches also require a shared content word before any low-confidence guess is accepted — this keeps ordinary conversation from triggering navigation.

---

## 🛠️ Available Commands

All commands accept natural phrasing: `"open X"`, `"go to X"`, `"click X"`, `"show me X"`, `"take me to X"`, or just `"X"`. Plurals, possessives and filler words are handled automatically.

### Admin Panel
| Say | Goes to |
| --- | --- |
| *"open user management"* / *"go to user management"* / *"manage users"* | `/admin/users` |
| *"open approval requests"* / *"view requests"* | `/admin/requests` |
| *"review pending requests"* / *"pending requests"* / *"review now"* | `/admin/requests?status=pending` |
| *"rejected requests"* | `/admin/requests?status=rejected` |
| *"open default templates"* / *"manage default templates"* | `/admin/default-templates` |
| *"open admin dashboard"* / *"admin panel"* | `/admin/dashboard` |
| *"visitors"* / *"customers"* | filtered user lists |

### Web App
| Say | Goes to |
| --- | --- |
| *"go to dashboard"* / *"templates"* / *"my templates"* | `/app/templates` |
| *"create template"* / *"new template"* / *"add a template"* | `/app/new` |
| *"view templates"* / *"browse templates"* | `/app/view` |
| *"send email"* / *"send an application"* | `/app/send` |
| *"update template"* / *"edit template"* | `/app/update` |
| *"request access"* | `/app/request-access` |
| *"request status"* | `/app/request-status` |

### Session & Navigation
- *"log out"* / *"sign out"* — ends the session (requires high confidence)
- *"login"*, *"register"*, *"home"*, *"features"*, *"how it works"*
- *"go back"*, *"go forward"*, *"reload page"*
- *"scroll down"*, *"scroll up"*, *"scroll to top"*
- *"stop listening"* / *"mute"* — turns voice control off

### Clicking Anything On Screen
Anything visible can be clicked by name, e.g. *"click approve"*, *"click refresh"*, *"click save note"*, *"click edit user"*.

> **Destructive actions** (*delete*, *remove*, *reject*, *revoke*, *discard*, *reset*) are only clicked when you actually say that word — a fuzzy near-match will never press them.

### Page-Specific Commands
Pages can register custom commands using `useVoiceCommands`:
```javascript
import { useVoiceCommands } from "../voice/VoiceControlProvider";

// Inside your page component:
useVoiceCommands([
  {
    label: "Refresh Templates",              // shown in "did you mean" suggestions
    patterns: ["refresh templates", "reload templates"],
    run: () => fetchData(),
    feedback: "Refreshing templates.",
  },
]);
```
Commands are active only while the component is mounted, and re-register only when their patterns change (not on every render).

---

## ⚡ Performance Notes

The module is built so speech never blocks the UI:

- **Matching is synchronous inside the speech event.** The recognition callback is stable and reads the command registry from refs, so React rendering is never in the path between a transcript and its action.
- **Split contexts.** Actions (`registerCommands`, `toggleEnabled`) and status (`lastHeard`, feedback) live in separate contexts, so pages registering commands don't re-render while the user speaks.
- **Throttled transcript display.** Interim results are coalesced into a single `requestAnimationFrame` paint.
- **Bounded work.** Phrases are capped at 240 chars / 16 words, similarity results are memoized, and hopeless pattern comparisons exit early. Worst-case matching is well under a millisecond against the full registry.
- **Clean restart loop.** Recognition restarts on the next macrotask (not a fixed delay), backs off exponentially on repeated failures, and stops entirely on `not-allowed` instead of retry-storming. A watchdog revives sessions that die silently, and listening resumes when a backgrounded tab becomes visible again.
- **Instant response to finals.** Near-verbatim interim results fire early (after ~320 ms of stability) so common commands run before the engine finalises the sentence; a duplicate-suppression window prevents double execution.

---

## 🚀 Browser Compatibility
- **Full Support**: Google Chrome, Microsoft Edge, Brave (Chromium-based browsers).
- **Limited/Partial**: Safari, Firefox (browser support varies; `useSpeechRecognition` gracefully handles unsupported environments via `isSupported`, and the indicator hides itself).
- **Microphone permission**: if the user blocks the mic, the indicator turns red, reports it, and voice control switches itself off rather than retrying in a loop.
