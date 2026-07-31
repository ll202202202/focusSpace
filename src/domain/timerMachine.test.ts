import { describe, expect, it } from 'vitest'

import {
  completeTimer,
  createTimerState,
  getRemainingSeconds,
  pauseTimer,
  resetTimer,
  resumeTimer,
  selectMode,
  startTimer,
} from './timerMachine'

describe('timer machine', () => {
  it('uses the configured defaults with auto-start disabled', () => {
    const state = createTimerState()

    expect(state).toMatchObject({
      selectedMode: 'focus',
      status: 'idle',
      remainingSeconds: 25 * 60,
      durations: {
        focus: 25 * 60,
        shortBreak: 5 * 60,
        longBreak: 10 * 60,
      },
      autoStartNext: false,
    })
  })

  it('starts the selected timer from the supplied clock time', () => {
    const now = 1_000
    const state = startTimer(createTimerState(), now)

    expect(state).toMatchObject({
      selectedMode: 'focus',
      status: 'running',
      remainingSeconds: 25 * 60,
      endAt: now + 25 * 60 * 1_000,
    })
    expect(getRemainingSeconds(state, now + 30_000)).toBe(25 * 60 - 30)
  })

  it('pauses at the elapsed remaining time and resumes from that amount', () => {
    const started = startTimer(createTimerState(), 10_000)
    const paused = pauseTimer(started, 100_000)
    const resumed = resumeTimer(paused, 150_000)

    expect(paused).toMatchObject({
      status: 'paused',
      remainingSeconds: 25 * 60 - 90,
      endAt: null,
    })
    expect(resumed).toMatchObject({
      status: 'running',
      remainingSeconds: 25 * 60 - 90,
      endAt: 150_000 + (25 * 60 - 90) * 1_000,
    })
  })

  it('resets to the selected mode configured duration in idle state', () => {
    const paused = pauseTimer(startTimer(createTimerState(), 0), 60_000)
    const reset = resetTimer(paused)

    expect(reset).toMatchObject({
      selectedMode: 'focus',
      status: 'idle',
      remainingSeconds: 25 * 60,
      endAt: null,
    })
  })

  it('manually selects a configured mode without changing the cycle', () => {
    const state = selectMode(
      { ...createTimerState(), cycleIndex: 3 },
      'longBreak',
    )

    expect(state).toMatchObject({
      selectedMode: 'longBreak',
      status: 'idle',
      remainingSeconds: 10 * 60,
      endAt: null,
      cycleIndex: 3,
    })
  })

  it('routes the fourth completed focus stage to a long break', () => {
    let state = createTimerState({ sequenceEnabled: true })

    for (let completedFocuses = 1; completedFocuses <= 3; completedFocuses += 1) {
      const result = completeTimer(state, 0)
      expect(result).toMatchObject({
        selectedMode: 'shortBreak',
        status: 'completed',
        cycleIndex: completedFocuses,
      })
      state = selectMode(result, 'focus')
    }

    const fourth = completeTimer(state, 0)

    expect(fourth).toMatchObject({
      selectedMode: 'longBreak',
      status: 'completed',
      cycleIndex: 4,
    })
  })

  it('returns to focus and resets the cycle after a completed long break', () => {
    const completedLongBreak = completeTimer(
      {
        ...createTimerState({ sequenceEnabled: true }),
        selectedMode: 'longBreak',
        cycleIndex: 4,
      },
      0,
    )

    expect(completedLongBreak).toMatchObject({
      selectedMode: 'focus',
      status: 'completed',
      remainingSeconds: 25 * 60,
      endAt: null,
      cycleIndex: 0,
    })
  })

  it('completes without auto-starting the next mode', () => {
    const completed = completeTimer(createTimerState(), 0)

    expect(completed).toMatchObject({
      selectedMode: 'focus',
      status: 'completed',
      remainingSeconds: 0,
      endAt: null,
      autoStartNext: false,
    })
  })

  it('auto-starts the next sequenced stage from the supplied clock time', () => {
    const now = 1_000

    const completed = completeTimer(
      createTimerState({
        durations: { shortBreak: 5 * 60 },
        sequenceEnabled: true,
        autoStartNext: true,
      }),
      now,
    )

    expect(completed).toMatchObject({
      selectedMode: 'shortBreak',
      status: 'running',
      remainingSeconds: 5 * 60,
      endAt: now + 5 * 60 * 1_000,
      cycleIndex: 1,
    })
  })

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['fractional', 1.5],
    ['NaN', Number.NaN],
    ['infinite', Number.POSITIVE_INFINITY],
  ])('rejects %s timer durations', (_label, duration) => {
    expect(() => createTimerState({ durations: { focus: duration } })).toThrow(
      'Timer durations must be positive whole numbers of seconds',
    )
  })
})
