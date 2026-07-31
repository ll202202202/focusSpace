export type TimerMode = 'focus' | 'shortBreak' | 'longBreak'

export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed'

export type TimerDurations = Record<TimerMode, number>

export interface TimerState {
  selectedMode: TimerMode
  status: TimerStatus
  remainingSeconds: number
  endAt: number | null
  cycleIndex: number
  durations: TimerDurations
  sequenceEnabled: boolean
  autoStartNext: boolean
}

export interface TimerOptions {
  durations?: Partial<TimerDurations>
  sequenceEnabled?: boolean
  autoStartNext?: boolean
  selectedMode?: TimerMode
}

const defaultDurations: TimerDurations = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 10 * 60,
}

export function createTimerState(options: TimerOptions = {}): TimerState {
  const durations = { ...defaultDurations, ...options.durations }
  const selectedMode = options.selectedMode ?? 'focus'

  validateDurations(durations)

  return {
    selectedMode,
    status: 'idle',
    remainingSeconds: durations[selectedMode],
    endAt: null,
    cycleIndex: 0,
    durations,
    sequenceEnabled: options.sequenceEnabled ?? false,
    autoStartNext: options.autoStartNext ?? false,
  }
}

export function getRemainingSeconds(state: TimerState, now: number): number {
  if (state.status !== 'running' || state.endAt === null) {
    return state.remainingSeconds
  }

  return Math.max(0, Math.ceil((state.endAt - now) / 1_000))
}

export function startTimer(state: TimerState, now: number): TimerState {
  const remainingSeconds = state.remainingSeconds

  return {
    ...state,
    status: 'running',
    remainingSeconds,
    endAt: now + remainingSeconds * 1_000,
  }
}

export function pauseTimer(state: TimerState, now: number): TimerState {
  return {
    ...state,
    status: 'paused',
    remainingSeconds: getRemainingSeconds(state, now),
    endAt: null,
  }
}

export function resumeTimer(state: TimerState, now: number): TimerState {
  return {
    ...state,
    status: 'running',
    endAt: now + state.remainingSeconds * 1_000,
  }
}

export function resetTimer(state: TimerState): TimerState {
  return {
    ...state,
    status: 'idle',
    remainingSeconds: state.durations[state.selectedMode],
    endAt: null,
  }
}

export function selectMode(state: TimerState, mode: TimerMode): TimerState {
  return {
    ...state,
    selectedMode: mode,
    status: 'idle',
    remainingSeconds: state.durations[mode],
    endAt: null,
  }
}

export function completeTimer(state: TimerState, now: number): TimerState {
  if (!state.sequenceEnabled) {
    return {
      ...state,
      status: 'completed',
      remainingSeconds: 0,
      endAt: null,
    }
  }

  const cycleIndex = state.selectedMode === 'focus' ? state.cycleIndex + 1 : state.cycleIndex
  const nextMode = getSequenceNextMode(state.selectedMode, cycleIndex)
  const nextCycleIndex = state.selectedMode === 'longBreak' ? 0 : cycleIndex

  const remainingSeconds = state.durations[nextMode]

  return {
    ...state,
    selectedMode: nextMode,
    status: state.autoStartNext ? 'running' : 'completed',
    remainingSeconds,
    endAt: state.autoStartNext ? now + remainingSeconds * 1_000 : null,
    cycleIndex: nextCycleIndex,
  }
}

function validateDurations(durations: TimerDurations): void {
  if (Object.values(durations).some((duration) => !Number.isFinite(duration) || duration <= 0 || !Number.isInteger(duration))) {
    throw new Error('Timer durations must be positive whole numbers of seconds')
  }
}

function getSequenceNextMode(mode: TimerMode, cycleIndex: number): TimerMode {
  if (mode === 'focus') {
    return cycleIndex % 4 === 0 ? 'longBreak' : 'shortBreak'
  }

  return 'focus'
}
