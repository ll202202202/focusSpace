import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { defaultTimerSettings, type DailyFocusSummary, type FocusRepositories, type TimerSession } from '../storage/repositories'
import { createFocusStore } from '../store/useFocusStore'
import { TimerScreen } from './TimerScreen'

function createStore() {
  let currentTime = 1_000
  const sessions: TimerSession[] = []
  const summaries: DailyFocusSummary[] = []
  const repositories: FocusRepositories = {
    settings: {
      load: async () => ({ ...defaultTimerSettings }),
      save: async () => {},
    },
    sessions: {
      getById: async () => undefined,
      save: async (session: TimerSession) => {
        sessions.push(session)
      },
    },
    dailySummaries: {
      getByDate: async () => undefined,
      save: async (summary: DailyFocusSummary) => {
        summaries.push(summary)
      },
    },
    close: async () => {},
  }

  return {
    store: createFocusStore({ repositories, now: () => currentTime }),
    now: () => currentTime,
    sessions,
    summaries,
    setNow: (nextTime: number) => {
      currentTime = nextTime
    },
  }
}

describe('TimerScreen', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('lets a user start a 25-minute focus timer and exposes pause', () => {
    const { store, now } = createStore()

    render(<TimerScreen store={store} now={now} />)

    expect(screen.getByText('25:00')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '开始专注' }))

    expect(screen.getByRole('button', { name: '暂停' })).toBeVisible()
  })

  it('uses a semantic fieldset to group timer mode controls', () => {
    const { store, now } = createStore()

    render(<TimerScreen store={store} now={now} />)

    expect(screen.getByRole('group', { name: '计时模式' }).tagName).toBe('FIELDSET')
  })

  it('exposes the countdown as a labelled time element', () => {
    const { store, now } = createStore()

    render(<TimerScreen store={store} now={now} />)

    expect(screen.getByLabelText('剩余时间').tagName).toBe('TIME')
  })

  it('decrements the visible time after one second while running without further user action', () => {
    vi.useFakeTimers()
    const { store, now, setNow } = createStore()

    render(<TimerScreen store={store} now={now} />)
    fireEvent.click(screen.getByRole('button', { name: '开始专注' }))

    expect(screen.getByText('25:00')).toBeVisible()
    act(() => {
      setNow(2_000)
      vi.advanceTimersByTime(1_000)
    })

    expect(screen.getByText('24:59')).toBeVisible()
  })

  it('stops calling tick after the user pauses the running timer', async () => {
    vi.useFakeTimers()
    const { store, now } = createStore()
    const tick = vi.spyOn(store.getState(), 'tick')

    render(<TimerScreen store={store} now={now} />)
    fireEvent.click(screen.getByRole('button', { name: '开始专注' }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })
    expect(tick).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '暂停' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })

    expect(tick).toHaveBeenCalledTimes(1)
  })

  it('stops calling tick after the running timer screen unmounts', async () => {
    vi.useFakeTimers()
    const { store, now } = createStore()
    const tick = vi.spyOn(store.getState(), 'tick')

    const { unmount } = render(<TimerScreen store={store} now={now} />)
    fireEvent.click(screen.getByRole('button', { name: '开始专注' }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })
    expect(tick).toHaveBeenCalledTimes(1)

    unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000)
    })

    expect(tick).toHaveBeenCalledTimes(1)
  })

  it('completes and persists a running timer when its interval reaches the scheduled end', async () => {
    vi.useFakeTimers()
    const { store, now, sessions, summaries, setNow } = createStore()

    render(<TimerScreen store={store} now={now} />)
    fireEvent.click(screen.getByRole('button', { name: '开始专注' }))

    await act(async () => {
      setNow(1_501_000)
      await vi.advanceTimersByTimeAsync(1_000)
    })

    expect(store.getState().timer.status).toBe('completed')
    expect(sessions).toHaveLength(1)
    expect(summaries).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('专注已完成')
  })

  it('switches to a short break without increasing the completed focus count', async () => {
    const { store, now } = createStore()

    render(<TimerScreen store={store} now={now} />)

    expect(screen.getByText('已完成专注：0 / 4')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '短休息' }))

    await waitFor(() => expect(screen.getByText('05:00')).toBeVisible())
    expect(screen.getByText('已完成专注：0 / 4')).toBeVisible()
  })

  it('resets an active timer back to the configured focus duration', async () => {
    const { store, now } = createStore()

    render(<TimerScreen store={store} now={now} />)

    fireEvent.click(screen.getByRole('button', { name: '开始专注' }))
    fireEvent.click(screen.getByRole('button', { name: '重置计时' }))

    await waitFor(() => expect(screen.getByText('25:00')).toBeVisible())
    expect(screen.getByRole('button', { name: '开始专注' })).toBeVisible()
  })

  it('records the task input and announces the timer status politely', () => {
    const { store, now } = createStore()

    render(<TimerScreen store={store} now={now} />)

    fireEvent.change(screen.getByLabelText('当前任务'), { target: { value: '复习英语' } })

    expect(store.getState().task).toBe('复习英语')
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('status')).toHaveTextContent('专注准备开始')
  })
})
