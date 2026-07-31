# Focus Space Technical Design

## Technology choices

- React 19 + TypeScript: component-based UI and static typing.
- Vite: local development server and production builds.
- Zustand: application runtime state management.
- IndexedDB (wrapped with `idb`): local-first data persistence.
- Vitest + React Testing Library: testing domain logic and critical UI behavior.

## MVP architecture

The React browser app is divided into three layers: UI components only render state and dispatch user intents; the Zustand store coordinates runtime state; and pure TypeScript domain modules handle the Pomodoro state machine and sequence rules. IndexedDB repositories persist settings, sessions, and daily summaries, and are never accessed directly by components.

```text
React UI → Zustand application store → Timer domain engine
                                  └→ Repository port → IndexedDB adapter
```

## Core state

- `TimerMode`: `focus`, `shortBreak`, `longBreak`.
- `TimerStatus`: `idle`, `running`, `paused`, `completed`.
- `endAt`: the single source of time truth while running (Unix milliseconds). Remaining seconds are calculated from `endAt - now` to avoid drift caused by background throttling.
- `cycleIndex`: the number of completed focus rounds in the current sequence, from 0–4.

## Data persistence

| Store | Primary key | Contents |
| --- | --- | --- |
| `settings` | `default` | Timer durations, sequence, theme, sound, and accessibility preferences |
| `sessions` | UUID | A timer's mode, status, task, start/end time, and actual duration |
| `dailySummaries` | `YYYY-MM-DD` | Completed focus count, focus seconds, and interruption count |

On first launch, the default settings from the PRD are written; setting changes are saved immediately. If the page reloads during a timer, the app reads `endAt` and uses it to restore or complete the session.

## Domain boundaries and test seams

1. `timerMachine`: accepts commands and current state, then returns the next state and domain events; tested as pure functions with Vitest.
2. `sessionRepository`: reads and writes sessions and settings through repository interfaces; application workflows are tested with a fake repository, without depending on browser implementation details.
3. `TimerScreen`: tests are bounded by user-visible mode, time, start/pause/reset controls, and completion feedback; uses React Testing Library.

## Failures and permissions

- If notification permission is denied or unsupported, show non-blocking guidance without affecting the timer or sound.
- If IndexedDB is unavailable, fall back to an in-memory session and display a status notice that data will not be saved this time.
- If audio playback is blocked by browser autoplay policy, only attempt playback after the user's first interaction.

## Accessibility and performance

- Primary actions use native buttons with visible text; status updates are written to an `aria-live="polite"` region.
- Themes use CSS variables; “reduced motion” turns off non-essential animations.
- The store saves only `endAt`; the display refreshes once per second and corrects immediately when the page regains focus.

## Evolution strategy

P0 implements only a local-first, single-device experience. P2 adds remote adapters behind the `SessionRepository` and `SettingsRepository` interfaces; accounts and synchronization do not intrude on the timer domain model.
