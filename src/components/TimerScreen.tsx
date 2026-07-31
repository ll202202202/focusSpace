import { useEffect, useState, useSyncExternalStore } from 'react'
import type { StoreApi } from 'zustand/vanilla'

import { getRemainingSeconds, type TimerMode } from '../domain/timerMachine'
import type { FocusStoreState } from '../store/useFocusStore'

export interface TimerScreenProps {
  store: StoreApi<FocusStoreState>
  now?: () => number
}

export function TimerScreen({ store, now = Date.now }: TimerScreenProps) {
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState)
  const isRunning = state.timer.status === 'running'
  const isPaused = state.timer.status === 'paused'
  const [, rerender] = useState(0)

  useEffect(() => {
    if (!isRunning) {
      return
    }

    let isTicking = false

    const intervalId = window.setInterval(() => {
      if (!isTicking) {
        isTicking = true
        void store.getState().tick()
          .catch(() => undefined)
          .finally(() => {
            isTicking = false
          })
      }

      rerender((renderCount) => renderCount + 1)
    }, 1_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isRunning, store])

  const remainingSeconds = getRemainingSeconds(state.timer, now())
  const modeLabel = getModeLabel(state.timer.selectedMode)

  function handlePrimaryAction() {
    if (isRunning) {
      store.getState().pause()
      return
    }

    if (isPaused) {
      store.getState().resume()
      return
    }

    store.getState().start()
  }

  function handleModeSelection(mode: TimerMode) {
    void store.getState().selectMode(mode)
  }

  function handleReset() {
    void store.getState().reset()
  }

  return (
    <section className="timer-stage" aria-label="Pomodoro timer">
      <fieldset>
        <legend>Timer mode</legend>
        <button
          type="button"
          aria-pressed={state.timer.selectedMode === 'focus'}
          onClick={() => handleModeSelection('focus')}
        >
          Focus
        </button>
        <button
          type="button"
          aria-pressed={state.timer.selectedMode === 'shortBreak'}
          onClick={() => handleModeSelection('shortBreak')}
        >
          Short break
        </button>
        <button
          type="button"
          aria-pressed={state.timer.selectedMode === 'longBreak'}
          onClick={() => handleModeSelection('longBreak')}
        >
          Long break
        </button>
      </fieldset>
      <time aria-label="Time remaining" dateTime={`PT${remainingSeconds}S`}>
        {formatDuration(remainingSeconds)}
      </time>
      <p className="cycle-label">Completed focus sessions: {state.timer.cycleIndex} / 4</p>
      <ol className="cycle-dots" aria-label={`Completed focus rounds: ${state.timer.cycleIndex} / 4`}>
        {Array.from({ length: 4 }, (_, index) => (
          <li key={index} aria-label={index < state.timer.cycleIndex ? 'Completed' : 'Not completed'}>
            {index < state.timer.cycleIndex ? '●' : '○'}
          </li>
        ))}
      </ol>
      <div className="task-field">
        <label htmlFor="timer-task">Current task</label>
        <input
          id="timer-task"
          type="text"
          placeholder="What would you like to work on?"
          value={state.task ?? ''}
          onChange={(event) => store.getState().setTask(event.currentTarget.value || null)}
        />
      </div>
      <button type="button" className="primary-action" onClick={handlePrimaryAction}>
        {isRunning ? 'Pause' : isPaused ? 'Resume focus' : 'Start focus'}
      </button>
      <button type="button" className="reset-action" aria-label="Reset timer" onClick={handleReset}>
        Reset
      </button>
      <p role="status" aria-live="polite">
        {getStatusMessage(state, modeLabel)}
      </p>
    </section>
  )
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function getModeLabel(mode: TimerMode): string {
  return {
    focus: 'Focus',
    shortBreak: 'Short break',
    longBreak: 'Long break',
  }[mode]
}

function getStatusMessage(state: FocusStoreState, modeLabel: string): string {
  if (state.persistenceError !== null) {
    return 'Unable to save data. Changes from this session may be lost.'
  }

  if (state.completion !== null || state.timer.status === 'completed') {
    return `${modeLabel} complete`
  }

  if (state.timer.status === 'running') {
    return `${modeLabel} in progress`
  }

  if (state.timer.status === 'paused') {
    return `${modeLabel} paused`
  }

  return `${modeLabel} ready to begin`
}
