import { createStore, type StoreApi } from 'zustand/vanilla'

import {
  completeTimer,
  createTimerState,
  getRemainingSeconds,
  pauseTimer,
  resetTimer,
  resumeTimer,
  selectMode as selectTimerMode,
  startTimer,
  type TimerMode,
  type TimerState,
} from '../domain/timerMachine'
import {
  defaultTimerSettings,
  type DailyFocusSummary,
  type FocusRepositories,
  type TimerSession,
  type TimerSettings,
} from '../storage/repositories'

interface ActiveSession {
  id: string
  mode: TimerMode
  task: string | null
  startedAt: number
  scheduledEndAt: number | null
  durationSeconds: number
}

export interface FocusCompletion {
  mode: TimerMode
  session: TimerSession
}

export interface FocusStoreState {
  isInitialized: boolean
  settings: TimerSettings
  timer: TimerState
  task: string | null
  completion: FocusCompletion | null
  persistenceError: Error | null
  activeSession: ActiveSession | null
  initialize(): Promise<void>
  start(): void
  pause(): void
  resume(): void
  reset(): Promise<void>
  selectMode(mode: TimerMode): Promise<void>
  setTask(task: string | null): void
  saveSettings(settings: Partial<TimerSettings>): Promise<void>
  tick(): Promise<void>
  clearCompletion(): void
}

export interface CreateFocusStoreOptions {
  repositories: FocusRepositories
  now(): number
}

export function createFocusStore({ repositories, now }: CreateFocusStoreOptions): StoreApi<FocusStoreState> {
  let isTerminalOperationInFlight = false

  function claimTerminalOperation(): boolean {
    if (isTerminalOperationInFlight) {
      return false
    }

    isTerminalOperationInFlight = true
    return true
  }

  function releaseTerminalOperation(): void {
    isTerminalOperationInFlight = false
  }

  return createStore<FocusStoreState>((set, get) => ({
    isInitialized: false,
    settings: { ...defaultTimerSettings },
    timer: createTimerForSettings(defaultTimerSettings),
    task: null,
    completion: null,
    persistenceError: null,
    activeSession: null,
    async initialize() {
      const settings = await repositories.settings.load()
      set({ isInitialized: true, settings, timer: createTimerForSettings(settings) })
    },
    start() {
      const state = get()

      if (state.timer.status === 'running' || state.timer.status === 'paused') {
        return
      }

      const startedAt = now()
      const timer = startTimer(state.timer.status === 'completed' ? resetTimer(state.timer) : state.timer, startedAt)
      set({
        timer,
        completion: null,
        persistenceError: null,
        activeSession: createActiveSession(timer, startedAt, state.task),
      })
    },
    pause() {
      const state = get()

      if (state.timer.status === 'running') {
        set({ timer: pauseTimer(state.timer, now()) })
      }
    },
    resume() {
      const state = get()

      if (state.timer.status === 'paused') {
        set({ timer: resumeTimer(state.timer, now()) })
      }
    },
    async reset() {
      const state = get()
      const currentTime = now()

      if (state.activeSession !== null && !claimTerminalOperation()) {
        return
      }

      try {
        if (state.activeSession !== null && hasReachedScheduledEnd(state.timer, currentTime)) {
          const timer = completeTimer(state.timer, currentTime)
          const session = completedSession(state.activeSession)
          await repositories.sessions.save(session)
          await updateDailySummary(repositories, session)
          set({
            timer,
            completion: { mode: session.mode, session },
            activeSession: timer.status === 'running' ? createActiveSession(timer, currentTime, null) : null,
          })
        } else {
          await persistInterruption(repositories, state, currentTime)
        }
      } catch (error) {
        set({ persistenceError: asPersistenceError(error) })
        return
      } finally {
        if (state.activeSession !== null) {
          releaseTerminalOperation()
        }
      }

      const currentState = get()
      set({ timer: resetTimer(currentState.timer), persistenceError: null, activeSession: null })
    },
    async selectMode(mode) {
      const state = get()
      const currentTime = now()

      if (state.activeSession !== null && !claimTerminalOperation()) {
        return
      }

      try {
        if (state.activeSession !== null && hasReachedScheduledEnd(state.timer, currentTime)) {
          const timer = completeTimer(state.timer, currentTime)
          const session = completedSession(state.activeSession)
          await repositories.sessions.save(session)
          await updateDailySummary(repositories, session)
          set({
            timer,
            completion: { mode: session.mode, session },
            activeSession: timer.status === 'running' ? createActiveSession(timer, currentTime, null) : null,
          })
        } else {
          await persistInterruption(repositories, state, currentTime)
        }
      } catch (error) {
        set({ persistenceError: asPersistenceError(error) })
        return
      } finally {
        if (state.activeSession !== null) {
          releaseTerminalOperation()
        }
      }

      const currentState = get()
      set({ timer: selectTimerMode(currentState.timer, mode), persistenceError: null, activeSession: null })
    },
    setTask(task) {
      set({ task })
    },
    async saveSettings(settings) {
      const state = get()
      const nextSettings = { ...state.settings, ...settings }
      const configuredTimer = createTimerForSettings(nextSettings, state.timer.selectedMode)
      await repositories.settings.save(nextSettings)
      set({
        settings: nextSettings,
        timer: state.timer.status === 'idle'
          ? configuredTimer
          : {
              ...state.timer,
              durations: configuredTimer.durations,
              sequenceEnabled: configuredTimer.sequenceEnabled,
              autoStartNext: configuredTimer.autoStartNext,
            },
      })
    },
    async tick() {
      const state = get()
      const currentTime = now()

      if (state.timer.status !== 'running' || getRemainingSeconds(state.timer, currentTime) > 0) {
        return
      }

      const timer = completeTimer(state.timer, currentTime)
      const activeSession = state.activeSession

      if (activeSession === null) {
        set({ timer })
        return
      }

      if (!claimTerminalOperation()) {
        return
      }

      const session = completedSession(activeSession)
      try {
        await repositories.sessions.save(session)
        await updateDailySummary(repositories, session)
        set({
          timer,
          completion: { mode: session.mode, session },
          persistenceError: null,
          activeSession: timer.status === 'running' ? createActiveSession(timer, currentTime, null) : null,
        })
      } catch (error) {
        set({ persistenceError: asPersistenceError(error) })
      } finally {
        releaseTerminalOperation()
      }
    },
    clearCompletion() {
      set({ completion: null })
    },
  }))
}

function hasReachedScheduledEnd(timer: TimerState, currentTime: number): boolean {
  return timer.status === 'running' && getRemainingSeconds(timer, currentTime) === 0
}

function asPersistenceError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Unable to persist the timer session')
}

function createTimerForSettings(settings: TimerSettings, selectedMode?: TimerMode): TimerState {
  return createTimerState({
    durations: {
      focus: settings.focusMinutes * 60,
      shortBreak: settings.shortBreakMinutes * 60,
      longBreak: settings.longBreakMinutes * 60,
    },
    sequenceEnabled: settings.sequenceEnabled,
    autoStartNext: settings.autoStartNext,
    selectedMode,
  })
}

function createActiveSession(timer: TimerState, startedAt: number, task: string | null): ActiveSession {
  return {
    id: crypto.randomUUID(),
    mode: timer.selectedMode,
    task,
    startedAt,
    scheduledEndAt: timer.endAt,
    durationSeconds: timer.remainingSeconds,
  }
}

function completedSession(activeSession: ActiveSession): TimerSession {
  return {
    id: activeSession.id,
    mode: activeSession.mode,
    status: 'completed',
    task: activeSession.task,
    startedAt: activeSession.startedAt,
    endAt: activeSession.scheduledEndAt,
    actualDurationSeconds: activeSession.durationSeconds,
  }
}

async function persistInterruption(
  repositories: FocusRepositories,
  state: FocusStoreState,
  currentTime: number,
): Promise<void> {
  if (state.activeSession === null) {
    return
  }

  const session: TimerSession = {
    id: state.activeSession.id,
    mode: state.activeSession.mode,
    status: 'interrupted',
    task: state.activeSession.task,
    startedAt: state.activeSession.startedAt,
    endAt: state.activeSession.scheduledEndAt,
    actualDurationSeconds: Math.max(
      0,
      state.activeSession.durationSeconds - getRemainingSeconds(state.timer, currentTime),
    ),
  }

  await repositories.sessions.save(session)
  await updateDailySummary(repositories, session)
}

async function updateDailySummary(repositories: FocusRepositories, session: TimerSession): Promise<void> {
  if (session.mode !== 'focus') {
    return
  }

  const date = localCalendarDate(session.startedAt)
  const previous = await repositories.dailySummaries.getByDate(date)
  const summary: DailyFocusSummary = {
    date,
    completedFocusSessions: (previous?.completedFocusSessions ?? 0) + (session.status === 'completed' ? 1 : 0),
    focusSeconds: (previous?.focusSeconds ?? 0) + (session.status === 'completed' ? session.actualDurationSeconds : 0),
    interruptedSessions: (previous?.interruptedSessions ?? 0) + (session.status === 'interrupted' ? 1 : 0),
  }

  await repositories.dailySummaries.save(summary)
}

function localCalendarDate(timestamp: number): string {
  const date = new Date(timestamp)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${date.getFullYear()}-${month}-${day}`
}
