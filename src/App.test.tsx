import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { defaultTimerSettings, type DailyFocusSummary, type FocusRepositories, type TimerSession } from './storage/repositories'
import { createFocusStore } from './store/useFocusStore'
import { App } from './App'

function createStore() {
  const repositories: FocusRepositories = {
    settings: {
      load: async () => ({ ...defaultTimerSettings, theme: 'dark', reducedMotion: true }),
      save: async () => {},
    },
    sessions: {
      getById: async () => undefined,
      save: async (_session: TimerSession) => {},
    },
    dailySummaries: {
      getByDate: async () => undefined,
      save: async (_summary: DailyFocusSummary) => {},
    },
    close: async () => {},
  }

  return createFocusStore({ repositories, now: () => 1_000 })
}

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('initializes the supplied store, applies preferences, and opens settings', async () => {
    const store = createStore()

    render(<App store={store} />)

    expect(screen.getByRole('heading', { name: 'Focus Space' })).toBeVisible()
    await waitFor(() => expect(store.getState().isInitialized).toBe(true))
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement).toHaveAttribute('data-reduced-motion', 'true')

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }))
    expect(screen.getByRole('dialog', { name: '设置' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: '关闭设置' }))
    expect(screen.queryByRole('dialog', { name: '设置' })).not.toBeInTheDocument()
  })

  it('checks the timer when the window regains focus or the page becomes visible', () => {
    const store = createStore()
    const tick = vi.spyOn(store.getState(), 'tick').mockResolvedValue()

    render(<App store={store} />)

    fireEvent.focus(window)
    document.dispatchEvent(new Event('visibilitychange'))

    expect(tick).toHaveBeenCalledTimes(2)
  })

  it('renders the timer in an immersive full-screen scene', () => {
    const store = createStore()

    render(<App store={store} />)

    expect(screen.getByTestId('immersive-scene')).toBeVisible()
    expect(screen.getByRole('main')).toHaveClass('immersive-timer')
  })

  it('enters browser fullscreen from the lower-right control', () => {
    const store = createStore()
    const requestFullscreen = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    })

    render(<App store={store} />)

    fireEvent.click(screen.getByRole('button', { name: '进入全屏' }))

    expect(requestFullscreen).toHaveBeenCalledOnce()
  })

  it('plays a completion cue and sends a notification when both preferences allow it', async () => {
    const store = createStore()
    const notification = vi.fn()
    const oscillator = {
      type: 'sine',
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
    const createAudioContext = vi.fn()
    class FakeAudioContext {
      currentTime = 0
      destination = {}

      constructor() {
        createAudioContext()
      }

      createOscillator() {
        return { ...oscillator, addEventListener: vi.fn() }
      }

      createGain() {
        return { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() }
      }

      close() {
        return Promise.resolve()
      }
    }

    vi.stubGlobal('Notification', Object.assign(notification, { permission: 'granted' }))
    vi.stubGlobal('AudioContext', FakeAudioContext)
    render(<App store={store} />)

    act(() => {
      store.setState({
        completion: {
          mode: 'focus',
          session: {
            id: 'completed-session',
            mode: 'focus',
            status: 'completed',
            task: null,
            startedAt: 1_000,
            endAt: 1_100,
            actualDurationSeconds: 100,
          },
        },
      })
    })

    await waitFor(() => expect(notification).toHaveBeenCalledWith('专注已完成', { body: '可以开始下一阶段了。' }))
    expect(createAudioContext).toHaveBeenCalledOnce()
    expect(oscillator.start).toHaveBeenCalledOnce()
  })

  it('announces a pre-existing completion only once in strict mode', async () => {
    const store = createStore()
    const notification = vi.fn()
    vi.stubGlobal('Notification', Object.assign(notification, { permission: 'granted' }))
    store.setState({
      completion: {
        mode: 'focus',
        session: {
          id: 'pre-existing-completion',
          mode: 'focus',
          status: 'completed',
          task: null,
          startedAt: 1_000,
          endAt: 1_100,
          actualDurationSeconds: 100,
        },
      },
    })

    render(
      <StrictMode>
        <App store={store} />
      </StrictMode>,
    )

    await waitFor(() => expect(notification).toHaveBeenCalledTimes(1))
  })

  it('keeps an owned repository usable after Strict Mode re-runs effects', async () => {
    let closed = false
    let saveCalls = 0
    const repositories: FocusRepositories = {
      settings: {
        load: async () => ({ ...defaultTimerSettings }),
        save: async () => {
          if (closed) {
            throw new Error('repository was closed')
          }
          saveCalls += 1
        },
      },
      sessions: { getById: async () => undefined, save: async () => {} },
      dailySummaries: { getByDate: async () => undefined, save: async () => {} },
      close: async () => { closed = true },
    }

    render(
      <StrictMode>
        <App repositories={repositories} />
      </StrictMode>,
    )

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }))
    fireEvent.click(screen.getByRole('button', { name: '保存设置' }))

    await waitFor(() => expect(saveCalls).toBe(1))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
