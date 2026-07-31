import 'fake-indexeddb/auto'

import { openDB } from 'idb'
import { afterEach, describe, expect, it } from 'vitest'

import {
  createIndexedDbRepositories,
  defaultTimerSettings,
  type DailyFocusSummary,
  type FocusRepositories,
  type TimerSession,
} from './repositories'

const repositoriesToClose: FocusRepositories[] = []

function createRepositories(databaseName = `focus-space-repositories-${crypto.randomUUID()}`): FocusRepositories {
  const repositories = createIndexedDbRepositories(databaseName)
  repositoriesToClose.push(repositories)
  return repositories
}

afterEach(async () => {
  await Promise.all(repositoriesToClose.splice(0).map((repositories) => repositories.close()))
})

describe('IndexedDB repositories', () => {
  it('reloads settings saved with a custom focus duration', async () => {
    const repositories = createRepositories()
    const settings = { ...defaultTimerSettings, focusMinutes: 50 }

    await repositories.settings.save(settings)

    await expect(repositories.settings.load()).resolves.toEqual(settings)
  })

  it('reloads a saved browser notification preference', async () => {
    const repositories = createRepositories()
    const settings = { ...defaultTimerSettings, notificationsEnabled: false }

    await repositories.settings.save(settings)

    await expect(repositories.settings.load()).resolves.toEqual(settings)
  })

  it('persists the default settings record on first load', async () => {
    const databaseName = `focus-space-repositories-${crypto.randomUUID()}`
    const repositories = createRepositories(databaseName)
    const firstLoad = await repositories.settings.load()
    const database = await openDB(databaseName)

    await expect(database.get('settings', 'default')).resolves.toEqual(firstLoad)
    await expect(createRepositories(databaseName).settings.load()).resolves.toEqual(firstLoad)
    database.close()
  })

  it('returns a fresh default settings value after a caller mutates the first load', async () => {
    const repositories = createRepositories()
    const firstLoad = await repositories.settings.load()

    firstLoad.focusMinutes = 50

    await expect(repositories.settings.load()).resolves.toEqual(defaultTimerSettings)
  })

  it('normalizes a malformed persisted settings record', async () => {
    const databaseName = `focus-space-repositories-${crypto.randomUUID()}`
    const database = await openDB(databaseName, 1, {
      upgrade(db) {
        db.createObjectStore('settings')
      },
    })

    await database.put('settings', {
      focusMinutes: 40,
      shortBreakMinutes: 0,
      longBreakMinutes: 'ten',
      sequenceEnabled: 'yes',
      autoStartNext: true,
      theme: 'midnight',
      soundEnabled: false,
      reducedMotion: 1,
    }, 'default')
    database.close()

    await expect(createRepositories(databaseName).settings.load()).resolves.toEqual({
      ...defaultTimerSettings,
      focusMinutes: 40,
      autoStartNext: true,
      soundEnabled: false,
    })
  })

  it('closes its database connection on request', async () => {
    const databaseName = `focus-space-repositories-${crypto.randomUUID()}`
    const repositories = createRepositories(databaseName)

    await repositories.settings.load()
    await repositories.close()

    const upgradedDatabase = await openDB(databaseName, 2, {
      upgrade(db) {
        db.createObjectStore('upgraded')
      },
    })
    upgradedDatabase.close()
  })

  it('closes its connection when it blocks a database upgrade', async () => {
    const databaseName = `focus-space-repositories-${crypto.randomUUID()}`
    const repositories = createRepositories(databaseName)

    await repositories.settings.load()

    const upgradedDatabase = await openDB(databaseName, 2, {
      upgrade(db) {
        db.createObjectStore('upgraded')
      },
    })

    expect(upgradedDatabase.objectStoreNames.contains('upgraded')).toBe(true)
    upgradedDatabase.close()
  })

  it('reloads an interrupted session including its scheduled end time', async () => {
    const repositories = createRepositories()
    const session: TimerSession = {
      id: 'session-interrupted',
      mode: 'focus',
      status: 'interrupted',
      task: 'Review lecture notes',
      startedAt: 1_700_000_000_000,
      endAt: 1_700_001_500_000,
      actualDurationSeconds: 0,
    }

    await repositories.sessions.save(session)

    await expect(repositories.sessions.getById(session.id)).resolves.toEqual(session)
  })

  it('reloads a daily focus summary by date', async () => {
    const repositories = createRepositories()
    const summary: DailyFocusSummary = {
      date: '2026-07-29',
      completedFocusSessions: 3,
      focusSeconds: 4_500,
      interruptedSessions: 1,
    }

    await repositories.dailySummaries.save(summary)

    await expect(repositories.dailySummaries.getByDate(summary.date)).resolves.toEqual(summary)
  })
})
