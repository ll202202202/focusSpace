import { describe, expect, it } from 'vitest'

import {
  defaultTimerSettings,
  type DailyFocusSummary,
  type FocusRepositories,
  type TimerSession,
  type TimerSettings,
} from '../storage/repositories'
import { createFocusStore } from './useFocusStore'

function createFakeRepositories(initialSettings: TimerSettings = { ...defaultTimerSettings }) {
  let settings = initialSettings
  const sessions: TimerSession[] = []
  const summaries = new Map<string, DailyFocusSummary>()

  const repositories: FocusRepositories = {
    settings: {
      load: async () => settings,
      save: async (nextSettings) => {
        settings = nextSettings
      },
    },
    sessions: {
      getById: async (id) => sessions.find((session) => session.id === id),
      save: async (session) => {
        sessions.push(session)
      },
    },
    dailySummaries: {
      getByDate: async (date) => summaries.get(date),
      save: async (summary) => {
        summaries.set(summary.date, summary)
      },
    },
    close: async () => {},
  }

  return { repositories, sessions, summaries, getSettings: () => settings }
}

describe('focus store', () => {
  it('writes a completed focus session when tick reaches its scheduled end time', async () => {
    const { repositories, sessions, summaries } = createFakeRepositories()
    let currentTime = 1_000
    const store = createFocusStore({ repositories, now: () => currentTime })

    await store.getState().initialize()
    store.getState().start()
    const endAt = store.getState().timer.endAt

    expect(endAt).toBe(1_501_000)

    currentTime = endAt!
    await store.getState().tick()

    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({
      mode: 'focus',
      status: 'completed',
      startedAt: 1_000,
      endAt: 1_501_000,
      actualDurationSeconds: 1_500,
    })
    expect(summaries.get('1970-01-01')).toEqual({
      date: '1970-01-01',
      completedFocusSessions: 1,
      focusSeconds: 1_500,
      interruptedSessions: 0,
    })
  })

  it('keys the daily focus summary by the local calendar day of the session start', async () => {
    const { repositories, summaries } = createFakeRepositories()
    const environment = globalThis as typeof globalThis & { process: { env: Record<string, string | undefined> } }
    const previousTimeZone = environment.process.env.TZ
    environment.process.env.TZ = 'Asia/Shanghai'

    try {
      let currentTime = new Date('2025-12-31T16:30:00.000Z').getTime()
      const store = createFocusStore({ repositories, now: () => currentTime })

      await store.getState().initialize()
      store.getState().start()
      currentTime = store.getState().timer.endAt!
      await store.getState().tick()

      expect(summaries.get('2026-01-01')).toMatchObject({
        date: '2026-01-01',
        completedFocusSessions: 1,
      })
    } finally {
      environment.process.env.TZ = previousTimeZone
    }
  })

  it('completes a session only once when concurrent ticks reach its scheduled end time', async () => {
    const { repositories, sessions, summaries } = createFakeRepositories()
    let currentTime = 1_000
    let summarySaveCount = 0
    repositories.sessions.save = async (session) => {
      await delay()
      sessions.push(session)
    }
    repositories.dailySummaries.save = async (summary) => {
      await delay()
      summarySaveCount += 1
      summaries.set(summary.date, summary)
    }
    const store = createFocusStore({ repositories, now: () => currentTime })

    await store.getState().initialize()
    store.getState().start()
    currentTime = store.getState().timer.endAt!

    await Promise.all([store.getState().tick(), store.getState().tick()])

    expect(sessions).toHaveLength(1)
    expect(summaries.get('1970-01-01')).toEqual({
      date: '1970-01-01',
      completedFocusSessions: 1,
      focusSeconds: 1_500,
      interruptedSessions: 0,
    })
    expect(summarySaveCount).toBe(1)
  })

  it('records a persistence error instead of reporting a completed session when saving fails', async () => {
    const { repositories } = createFakeRepositories()
    const persistenceError = new Error('IndexedDB is unavailable')
    let currentTime = 1_000
    repositories.sessions.save = async () => {
      throw persistenceError
    }
    const store = createFocusStore({ repositories, now: () => currentTime })

    await store.getState().initialize()
    store.getState().start()
    currentTime = store.getState().timer.endAt!

    await expect(store.getState().tick()).resolves.toBeUndefined()

    expect(store.getState().persistenceError).toBe(persistenceError)
    expect(store.getState().completion).toBeNull()
    expect(store.getState().activeSession).not.toBeNull()
  })

  it('allows only one terminal outcome when tick and reset race at the scheduled end time', async () => {
    const { repositories, sessions, summaries } = createFakeRepositories()
    let currentTime = 1_000
    repositories.sessions.save = async (session) => {
      await delay()
      sessions.push(session)
    }
    const store = createFocusStore({ repositories, now: () => currentTime })

    await store.getState().initialize()
    store.getState().start()
    currentTime = store.getState().timer.endAt!

    await Promise.all([store.getState().tick(), store.getState().reset()])

    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({ status: 'completed' })
    expect(summaries.get('1970-01-01')).toEqual({
      date: '1970-01-01',
      completedFocusSessions: 1,
      focusSeconds: 1_500,
      interruptedSessions: 0,
    })
  })

  it('allows only one terminal outcome when tick and mode selection race at the scheduled end time', async () => {
    const { repositories, sessions, summaries } = createFakeRepositories()
    let currentTime = 1_000
    repositories.sessions.save = async (session) => {
      await delay()
      sessions.push(session)
    }
    const store = createFocusStore({ repositories, now: () => currentTime })

    await store.getState().initialize()
    store.getState().start()
    currentTime = store.getState().timer.endAt!

    await Promise.all([store.getState().tick(), store.getState().selectMode('shortBreak')])

    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({ status: 'completed' })
    expect(summaries.get('1970-01-01')).toEqual({
      date: '1970-01-01',
      completedFocusSessions: 1,
      focusSeconds: 1_500,
      interruptedSessions: 0,
    })
  })

  it('does not auto-start the next sequence stage when the setting is disabled', async () => {
    const { repositories } = createFakeRepositories({
      ...defaultTimerSettings,
      focusMinutes: 1,
      sequenceEnabled: true,
    })
    let currentTime = 1_000
    const store = createFocusStore({ repositories, now: () => currentTime })

    await store.getState().initialize()
    store.getState().start()
    currentTime = store.getState().timer.endAt!
    await store.getState().tick()

    expect(store.getState().timer).toMatchObject({
      selectedMode: 'shortBreak',
      status: 'completed',
      endAt: null,
    })
    expect(store.getState().completion).toMatchObject({ mode: 'focus' })
  })

  it('auto-starts the next sequence stage when the setting is enabled', async () => {
    const { repositories } = createFakeRepositories({
      ...defaultTimerSettings,
      focusMinutes: 1,
      sequenceEnabled: true,
      autoStartNext: true,
    })
    let currentTime = 1_000
    const store = createFocusStore({ repositories, now: () => currentTime })

    await store.getState().initialize()
    store.getState().start()
    currentTime = store.getState().timer.endAt!
    await store.getState().tick()

    expect(store.getState().timer).toMatchObject({
      selectedMode: 'shortBreak',
      status: 'running',
      endAt: currentTime + 5 * 60 * 1_000,
    })
  })

  it('persists saved settings and updates the idle timer configuration', async () => {
    const { getSettings, repositories } = createFakeRepositories()
    const store = createFocusStore({ repositories, now: () => 1_000 })

    await store.getState().initialize()
    await store.getState().saveSettings({ focusMinutes: 50, autoStartNext: true })

    expect(getSettings()).toMatchObject({ focusMinutes: 50, autoStartNext: true })
    expect(store.getState().timer).toMatchObject({
      remainingSeconds: 50 * 60,
      autoStartNext: true,
    })
  })

  it('persists an interrupted paused session with its original scheduled end time', async () => {
    const { repositories, sessions, summaries } = createFakeRepositories()
    let currentTime = 1_000
    const store = createFocusStore({ repositories, now: () => currentTime })

    await store.getState().initialize()
    store.getState().setTask('Read chapter one')
    store.getState().start()
    const scheduledEndAt = store.getState().timer.endAt

    currentTime = 11_000
    store.getState().pause()
    await store.getState().reset()

    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({
      mode: 'focus',
      status: 'interrupted',
      task: 'Read chapter one',
      endAt: scheduledEndAt,
      actualDurationSeconds: 10,
    })
    expect(summaries.get('1970-01-01')).toMatchObject({ interruptedSessions: 1 })
  })

  it('persists only one interruption when reset is requested twice concurrently', async () => {
    const { repositories, sessions, summaries } = createFakeRepositories()
    let currentTime = 1_000
    repositories.sessions.save = async (session) => {
      await delay()
      sessions.push(session)
    }
    const store = createFocusStore({ repositories, now: () => currentTime })

    await store.getState().initialize()
    store.getState().start()
    currentTime += 10_000

    await Promise.all([store.getState().reset(), store.getState().reset()])

    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({ status: 'interrupted', actualDurationSeconds: 10 })
    expect(summaries.get('1970-01-01')).toEqual({
      date: '1970-01-01',
      completedFocusSessions: 0,
      focusSeconds: 0,
      interruptedSessions: 1,
    })
  })

  it('completes a running session that has already reached its end time before resetting', async () => {
    const { repositories, sessions, summaries } = createFakeRepositories()
    let currentTime = 1_000
    const store = createFocusStore({ repositories, now: () => currentTime })

    await store.getState().initialize()
    store.getState().start()
    currentTime = store.getState().timer.endAt!

    await store.getState().reset()

    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({
      status: 'completed',
      actualDurationSeconds: 1_500,
    })
    expect(summaries.get('1970-01-01')).toEqual({
      date: '1970-01-01',
      completedFocusSessions: 1,
      focusSeconds: 1_500,
      interruptedSessions: 0,
    })
  })

  it('completes a running session that has already reached its end time before selecting another mode', async () => {
    const { repositories, sessions, summaries } = createFakeRepositories()
    let currentTime = 1_000
    const store = createFocusStore({ repositories, now: () => currentTime })

    await store.getState().initialize()
    store.getState().start()
    currentTime = store.getState().timer.endAt!

    await store.getState().selectMode('shortBreak')

    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({ status: 'completed' })
    expect(summaries.get('1970-01-01')).toMatchObject({
      completedFocusSessions: 1,
      interruptedSessions: 0,
    })
    expect(store.getState().timer).toMatchObject({ selectedMode: 'shortBreak', status: 'idle' })
  })
})

function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
