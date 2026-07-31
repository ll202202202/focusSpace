# Focus Space P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first browser Pomodoro timer with three modes, sequence rules, settings, accessible controls, and IndexedDB persistence.

**Architecture:** Keep the timer state machine pure in `src/domain`, expose it through a Zustand application store, and persist settings and sessions behind repository interfaces. React components render the store state and only issue user-intent commands; they do not calculate timer transitions.

**Tech Stack:** React 19, TypeScript, Vite, Zustand, idb, Vitest, React Testing Library, jsdom.

---

## File structure

- `src/domain/timerMachine.ts` — timer modes, statuses, commands, state transitions, sequence events.
- `src/domain/timerMachine.test.ts` — public timer-machine behavior.
- `src/storage/repositories.ts` — settings/session repository contracts and IndexedDB implementation.
- `src/storage/repositories.test.ts` — persistence behavior via fake IndexedDB.
- `src/store/useFocusStore.ts` — Zustand store that schedules ticks and calls repositories.
- `src/store/useFocusStore.test.ts` — application workflow tests using a fake repository and fake clock.
- `src/components/TimerScreen.tsx` — accessible timer, mode picker and primary controls.
- `src/components/TimerScreen.test.tsx` — visible user workflow tests.
- `src/components/SettingsDialog.tsx` — settings fields, save and reset-confirmation UI.
- `src/App.tsx` / `src/main.tsx` / `src/styles.css` — composition, bootstrap and theme variables.

### Task 1: Create the Vite test harness

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `src/test/setup.ts`

- [ ] **Step 1: Add a smoke test that imports the test environment**

```ts
import { expect, test } from 'vitest';

test('test environment is available', () => {
  expect(document.createElement('button').tagName).toBe('BUTTON');
});
```

- [ ] **Step 2: Run `npm test -- --run` and verify the test fails because the test script is absent.**
- [ ] **Step 3: Add Vite, React, TypeScript, Vitest, Testing Library, Zustand and idb configuration; configure `test.environment` as `jsdom` and import `src/test/setup.ts`.**
- [ ] **Step 4: Run `npm test -- --run`; expected result: one passing smoke test.**

### Task 2: Implement the timer state machine

**Files:**
- Create: `src/domain/timerMachine.test.ts`, `src/domain/timerMachine.ts`

- [ ] **Step 1: Write a failing test for starting a focus timer.**

```ts
expect(startTimer(createTimerState(), 1_000)).toMatchObject({
  mode: 'focus', status: 'running', endAt: 1_501_000,
});
```

- [ ] **Step 2: Run `npm test -- src/domain/timerMachine.test.ts`; expected result: fail because `timerMachine` does not exist.**
- [ ] **Step 3: Implement `createTimerState`, `startTimer`, `pauseTimer`, `resumeTimer`, `resetTimer`, `selectMode`, and `completeTimer` with no browser dependencies.**
- [ ] **Step 4: Add one failing test at a time for pause preserving remaining seconds, reset restoring the selected mode default, and the fourth completed focus entering a long break when the sequence is enabled.**
- [ ] **Step 5: Implement the smallest transition needed after each red test and rerun the same file until all cases pass.**

### Task 3: Add persistent repositories

**Files:**
- Create: `src/storage/repositories.test.ts`, `src/storage/repositories.ts`

- [ ] **Step 1: Write a failing test that saves and reloads `TimerSettings`.**

```ts
await repository.saveSettings({ ...DEFAULT_SETTINGS, focusMinutes: 50 });
await expect(repository.getSettings()).resolves.toMatchObject({ focusMinutes: 50 });
```

- [ ] **Step 2: Run `npm test -- src/storage/repositories.test.ts`; expected result: fail because the repository is absent.**
- [ ] **Step 3: Define `SettingsRepository` and `SessionRepository` ports, then implement the IndexedDB adapter with `settings`, `sessions`, and `dailySummaries` object stores.**
- [ ] **Step 4: Add and pass tests for first-run default settings and writing an interrupted session.**

### Task 4: Build the application store

**Files:**
- Create: `src/store/useFocusStore.test.ts`, `src/store/useFocusStore.ts`

- [ ] **Step 1: Write a failing test that starts a session and records it as completed when `tick(now)` reaches `endAt`.**

```ts
store.start(1_000);
store.tick(1_501_000);
expect(fakeRepository.sessions[0]).toMatchObject({ status: 'completed', mode: 'focus' });
```

- [ ] **Step 2: Run `npm test -- src/store/useFocusStore.test.ts`; expected result: fail because `createFocusStore` does not exist.**
- [ ] **Step 3: Implement a dependency-injected `createFocusStore({ repository, now })`; the browser hook delegates to it.**
- [ ] **Step 4: Add and pass tests for completion notification events, automatic-next-stage off by default, and settings persistence.**

### Task 5: Build the accessible timer screen

**Files:**
- Create: `src/components/TimerScreen.test.tsx`, `src/components/TimerScreen.tsx`

- [ ] **Step 1: Write a failing UI test for a user starting and pausing a 25-minute focus timer.**

```tsx
render(<TimerScreen store={store} />);
await user.click(screen.getByRole('button', { name: '开始专注' }));
expect(screen.getByRole('button', { name: '暂停' })).toBeVisible();
```

- [ ] **Step 2: Run `npm test -- src/components/TimerScreen.test.tsx`; expected result: fail because the component is absent.**
- [ ] **Step 3: Implement mode buttons, countdown text, start/pause/reset controls, task input, cycle dots, and a polite live region.**
- [ ] **Step 4: Add and pass a test for switching to short break without increasing the completed focus count.**

### Task 6: Add settings and themes

**Files:**
- Create: `src/components/SettingsDialog.test.tsx`, `src/components/SettingsDialog.tsx`, `src/styles.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write a failing test that changes focus duration to 50 minutes and saves it.**

```tsx
await user.clear(screen.getByLabelText('专注时长（分钟）'));
await user.type(screen.getByLabelText('专注时长（分钟）'), '50');
await user.click(screen.getByRole('button', { name: '保存设置' }));
expect(store.getState().settings.focusMinutes).toBe(50);
```

- [ ] **Step 2: Run `npm test -- src/components/SettingsDialog.test.tsx`; expected result: fail because the dialog is absent.**
- [ ] **Step 3: Implement timer, sound, notification, theme and reduced-motion settings. Require confirmation before restoring defaults.**
- [ ] **Step 4: Add and pass a test proving reset confirmation is required before settings change.**

### Task 7: Compose, verify and document

**Files:**
- Create: `README.md`
- Modify: `src/App.tsx`, `src/main.tsx`

- [ ] **Step 1: Write a failing app test that renders `Focus Space` and exposes the timer’s live status.**
- [ ] **Step 2: Run the targeted app test and verify the failure is due to absent composition.**
- [ ] **Step 3: Compose the application, register the browser tick/focus handlers, and document local setup, test and build commands.**
- [ ] **Step 4: Run `npm test -- --run` and `npm run build`; expected result: all tests pass and Vite completes the production build.**
