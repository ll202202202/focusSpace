import { openDB, type DBSchema } from 'idb'

import type { TimerMode } from '../domain/timerMachine'

export interface TimerSettings {
  focusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  sequenceEnabled: boolean
  autoStartNext: boolean
  theme: 'light' | 'dark' | 'system'
  soundEnabled: boolean
  notificationsEnabled: boolean
  reducedMotion: boolean
}

export const defaultTimerSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 10,
  sequenceEnabled: false,
  autoStartNext: false,
  theme: 'system',
  soundEnabled: true,
  notificationsEnabled: true,
  reducedMotion: false,
} as const satisfies TimerSettings

function createDefaultTimerSettings(): TimerSettings {
  return { ...defaultTimerSettings }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPositiveWholeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function isTimerTheme(value: unknown): value is TimerSettings['theme'] {
  return value === 'light' || value === 'dark' || value === 'system'
}

function normalizeTimerSettings(value: unknown): TimerSettings {
  const defaults = createDefaultTimerSettings()

  if (!isRecord(value)) {
    return defaults
  }

  return {
    focusMinutes: isPositiveWholeNumber(value.focusMinutes) ? value.focusMinutes : defaults.focusMinutes,
    shortBreakMinutes: isPositiveWholeNumber(value.shortBreakMinutes) ? value.shortBreakMinutes : defaults.shortBreakMinutes,
    longBreakMinutes: isPositiveWholeNumber(value.longBreakMinutes) ? value.longBreakMinutes : defaults.longBreakMinutes,
    sequenceEnabled: typeof value.sequenceEnabled === 'boolean' ? value.sequenceEnabled : defaults.sequenceEnabled,
    autoStartNext: typeof value.autoStartNext === 'boolean' ? value.autoStartNext : defaults.autoStartNext,
    theme: isTimerTheme(value.theme) ? value.theme : defaults.theme,
    soundEnabled: typeof value.soundEnabled === 'boolean' ? value.soundEnabled : defaults.soundEnabled,
    notificationsEnabled: typeof value.notificationsEnabled === 'boolean'
      ? value.notificationsEnabled
      : defaults.notificationsEnabled,
    reducedMotion: typeof value.reducedMotion === 'boolean' ? value.reducedMotion : defaults.reducedMotion,
  }
}

export interface SettingsRepository {
  load(): Promise<TimerSettings>
  save(settings: TimerSettings): Promise<void>
}

export interface TimerSession {
  id: string
  mode: TimerMode
  status: 'running' | 'paused' | 'completed' | 'interrupted'
  task: string | null
  startedAt: number
  endAt: number | null
  actualDurationSeconds: number
}

export interface SessionRepository {
  getById(id: string): Promise<TimerSession | undefined>
  save(session: TimerSession): Promise<void>
}

export interface DailyFocusSummary {
  date: string
  completedFocusSessions: number
  focusSeconds: number
  interruptedSessions: number
}

export interface DailyFocusSummaryRepository {
  getByDate(date: string): Promise<DailyFocusSummary | undefined>
  save(summary: DailyFocusSummary): Promise<void>
}

export interface FocusRepositories {
  settings: SettingsRepository
  sessions: SessionRepository
  dailySummaries: DailyFocusSummaryRepository
  close(): Promise<void>
}

interface FocusSpaceDatabase extends DBSchema {
  settings: {
    key: string
    value: TimerSettings
  }
  sessions: {
    key: string
    value: TimerSession
  }
  dailySummaries: {
    key: string
    value: DailyFocusSummary
  }
}

export function createIndexedDbRepositories(databaseName = 'focus-space'): FocusRepositories {
  const database = openDB<FocusSpaceDatabase>(databaseName, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings')
      }
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('dailySummaries')) {
        db.createObjectStore('dailySummaries', { keyPath: 'date' })
      }
    },
    blocking() {
      void database.then((db) => db.close())
    },
  })

  return {
    settings: {
      async load() {
        const settings = await (await database).get('settings', 'default')

        if (settings !== undefined) {
          return normalizeTimerSettings(settings)
        }

        const defaultSettings = createDefaultTimerSettings()
        await (await database).put('settings', defaultSettings, 'default')
        return defaultSettings
      },
      async save(settings) {
        await (await database).put('settings', settings, 'default')
      },
    },
    sessions: {
      async getById(id) {
        return (await (await database).get('sessions', id))
      },
      async save(session) {
        await (await database).put('sessions', session)
      },
    },
    dailySummaries: {
      async getByDate(date) {
        return (await (await database).get('dailySummaries', date))
      },
      async save(summary) {
        await (await database).put('dailySummaries', summary)
      },
    },
    async close() {
      ;(await database).close()
    },
  }
}
