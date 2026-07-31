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
    <section className="timer-stage" aria-label="番茄钟">
      <fieldset>
        <legend>计时模式</legend>
        <button
          type="button"
          aria-pressed={state.timer.selectedMode === 'focus'}
          onClick={() => handleModeSelection('focus')}
        >
          专注
        </button>
        <button
          type="button"
          aria-pressed={state.timer.selectedMode === 'shortBreak'}
          onClick={() => handleModeSelection('shortBreak')}
        >
          短休息
        </button>
        <button
          type="button"
          aria-pressed={state.timer.selectedMode === 'longBreak'}
          onClick={() => handleModeSelection('longBreak')}
        >
          长休息
        </button>
      </fieldset>
      <time aria-label="剩余时间" dateTime={`PT${remainingSeconds}S`}>
        {formatDuration(remainingSeconds)}
      </time>
      <p className="cycle-label">已完成专注：{state.timer.cycleIndex} / 4</p>
      <ol className="cycle-dots" aria-label={`已完成专注轮次：${state.timer.cycleIndex} / 4`}>
        {Array.from({ length: 4 }, (_, index) => (
          <li key={index} aria-label={index < state.timer.cycleIndex ? '已完成' : '未完成'}>
            {index < state.timer.cycleIndex ? '●' : '○'}
          </li>
        ))}
      </ol>
      <div className="task-field">
        <label htmlFor="timer-task">当前任务</label>
        <input
          id="timer-task"
          type="text"
          placeholder="现在准备做些什么呢？"
          value={state.task ?? ''}
          onChange={(event) => store.getState().setTask(event.currentTarget.value || null)}
        />
      </div>
      <button type="button" className="primary-action" onClick={handlePrimaryAction}>
        {isRunning ? '暂停' : isPaused ? '继续专注' : '开始专注'}
      </button>
      <button type="button" className="reset-action" aria-label="重置计时" onClick={handleReset}>
        重置
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
    focus: '专注',
    shortBreak: '短休息',
    longBreak: '长休息',
  }[mode]
}

function getStatusMessage(state: FocusStoreState, modeLabel: string): string {
  if (state.persistenceError !== null) {
    return '数据保存失败，本次数据可能不会保存'
  }

  if (state.completion !== null || state.timer.status === 'completed') {
    return `${modeLabel}已完成`
  }

  if (state.timer.status === 'running') {
    return `${modeLabel}进行中`
  }

  if (state.timer.status === 'paused') {
    return `${modeLabel}已暂停`
  }

  return `${modeLabel}准备开始`
}
