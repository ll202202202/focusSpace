# Focus Space

An immersive focus space: a local-first Pomodoro timer. It supports focus, short-break, and long-break modes, and uses IndexedDB to save settings and focus records.

## Live demo

[https://focus-space-sepia.vercel.app/](https://focus-space-sepia.vercel.app/)

## Getting started

```bash
npm install
npm run dev
```

## Verification

```bash
npm test -- --run
npm run build
```

## Tech stack

- React + TypeScript + Vite
- Zustand for timer state management
- IndexedDB (via `idb`) for settings and session persistence
