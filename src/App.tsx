import { useEffect, useState, useSyncExternalStore } from 'react'
import type { StoreApi } from 'zustand/vanilla'

import { SettingsDialog } from './components/SettingsDialog'
import { TimerScreen } from './components/TimerScreen'
import { type TimerMode } from './domain/timerMachine'
import { createIndexedDbRepositories, type FocusRepositories } from './storage/repositories'
import { createFocusStore, type FocusStoreState } from './store/useFocusStore'

export interface AppProps {
  store?: StoreApi<FocusStoreState>
  repositories?: FocusRepositories
  now?: () => number
}

interface OwnedStore {
  repositories: FocusRepositories
  store: StoreApi<FocusStoreState>
}

export function App({ store, repositories, now = Date.now }: AppProps) {
  const [ownedStore] = useState<OwnedStore | null>(() => {
    if (store !== undefined) {
      return null
    }

    const resolvedRepositories = repositories ?? createIndexedDbRepositories()
    return {
      repositories: resolvedRepositories,
      store: createFocusStore({ repositories: resolvedRepositories, now }),
    }
  })
  const focusStore = store ?? ownedStore!.store
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  useEffect(() => {
    void focusStore.getState().initialize().catch(() => undefined)
  }, [focusStore])

  useEffect(() => {
    const refreshTimer = () => {
      void focusStore.getState().tick().catch(() => undefined)
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshTimer()
      }
    }

    window.addEventListener('focus', refreshTimer)
    document.addEventListener('visibilitychange', refreshWhenVisible)

    return () => {
      window.removeEventListener('focus', refreshTimer)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [focusStore])

  const state = useSyncExternalStore(focusStore.subscribe, focusStore.getState, focusStore.getState)
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = state.settings.theme
    root.dataset.reducedMotion = String(state.settings.reducedMotion)
  }, [state.settings.reducedMotion, state.settings.theme])

  useEffect(() => {
    const completion = focusStore.getState().completion
    if (completion === null) {
      return
    }

    const settings = focusStore.getState().settings
    const label = getModeLabel(completion.mode)

    if (settings.soundEnabled) {
      playCompletionSound()
    }
    if (settings.notificationsEnabled) {
      sendCompletionNotification(label)
    }

    focusStore.getState().clearCompletion()
  }, [focusStore, state.completion])

  return (
    <div className="app-shell" data-testid="immersive-scene">
      <header className="app-header">
        <div>
          <p className="app-kicker">Your immersive focus space</p>
          <h1>Focus Space</h1>
        </div>
        <button type="button" className="icon-button" aria-label="Open settings" onClick={() => setIsSettingsOpen(true)}>
          Settings
        </button>
      </header>
      <main className="app-main immersive-timer">
        <TimerScreen store={focusStore} now={now} />
      </main>
      <div className="fullscreen-control">
        <button type="button" aria-label="Enter full screen" title="Enter full screen" onClick={() => void requestFullscreen()}>
          ⛶
        </button>
      </div>
      {isSettingsOpen && <SettingsDialog store={focusStore} onClose={() => setIsSettingsOpen(false)} />}
    </div>
  )
}

async function requestFullscreen(): Promise<void> {
  try {
    await document.documentElement.requestFullscreen()
  } catch {
    // Fullscreen is optional; browsers can reject it when the feature is unavailable.
  }
}

function getModeLabel(mode: TimerMode): string {
  return {
    focus: 'Focus',
    shortBreak: 'Short break',
    longBreak: 'Long break',
  }[mode]
}

function playCompletionSound(): void {
  try {
    const context = new window.AudioContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const startTime = context.currentTime

    oscillator.type = 'sine'
    oscillator.frequency.value = 660
    gain.gain.setValueAtTime(0.08, startTime)
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(startTime)
    oscillator.stop(startTime + 0.22)
    oscillator.addEventListener('ended', () => void context.close(), { once: true })
  } catch {
    // A completion cue is optional; browsers may block audio before user interaction.
  }
}

function sendCompletionNotification(label: string): void {
  if (!('Notification' in window) || window.Notification.permission !== 'granted') {
    return
  }

  try {
    new window.Notification(`${label} complete`, { body: 'Time to begin the next phase.' })
  } catch {
    // Notifications are optional and must never interrupt the timer.
  }
}
