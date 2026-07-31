import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { StoreApi } from 'zustand/vanilla'

import { defaultTimerSettings, type TimerSettings } from '../storage/repositories'
import type { FocusStoreState } from '../store/useFocusStore'

export interface SettingsDialogProps {
  store: StoreApi<FocusStoreState>
  onClose?: () => void
}

type DurationField = 'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes'

const durationFields: ReadonlyArray<{ key: DurationField; label: string }> = [
  { key: 'focusMinutes', label: 'Focus duration (minutes)' },
  { key: 'shortBreakMinutes', label: 'Short break duration (minutes)' },
  { key: 'longBreakMinutes', label: 'Long break duration (minutes)' },
]

const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function SettingsDialog({ store, onClose }: SettingsDialogProps) {
  const settings = useSyncExternalStore(store.subscribe, store.getState, store.getState).settings
  const [draft, setDraft] = useState<TimerSettings>(settings)
  const [showRestoreConfirmation, setShowRestoreConfirmation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const dialogRef = useRef<HTMLElement>(null)
  const confirmationRef = useRef<HTMLElement>(null)
  const cancelRestoreRef = useRef<HTMLButtonElement>(null)
  const restoreTriggerRef = useRef<HTMLButtonElement>(null)
  const shouldRestoreFocusRef = useRef(false)

  useEffect(() => {
    const initialFocus = dialogRef.current?.querySelector<HTMLElement>(focusableSelector)
    initialFocus?.focus()
  }, [])

  useEffect(() => {
    if (showRestoreConfirmation) {
      cancelRestoreRef.current?.focus()
      return
    }

    if (shouldRestoreFocusRef.current) {
      restoreTriggerRef.current?.focus()
      shouldRestoreFocusRef.current = false
    }
  }, [showRestoreConfirmation])

  function updateDraft(update: Partial<TimerSettings>) {
    setDraft((current) => ({ ...current, ...update }))
  }

  async function save(nextSettings: TimerSettings) {
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      await store.getState().saveSettings(nextSettings)
      setDraft(nextSettings)
      setShowRestoreConfirmation(false)
      setSuccess('Settings saved')
    } catch (error) {
      console.error('Failed to save Focus Space settings', error)
      setError('Unable to save settings. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void save(draft)
  }

  function requestRestore(event: React.MouseEvent<HTMLButtonElement>) {
    restoreTriggerRef.current = event.currentTarget
    setShowRestoreConfirmation(true)
  }

  function closeRestoreConfirmation() {
    shouldRestoreFocusRef.current = true
    setShowRestoreConfirmation(false)
  }

  function handleConfirmationKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeRestoreConfirmation()
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const focusableElements = Array.from(
      confirmationRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
    )
    const firstElement = focusableElements[0]
    const lastElement = focusableElements.at(-1)

    if (firstElement === undefined || lastElement === undefined) {
      return
    }

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  }

  return (
    <div className="settings-backdrop">
      <section ref={dialogRef} className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <form onSubmit={handleSubmit} inert={showRestoreConfirmation} aria-hidden={showRestoreConfirmation || undefined}>
          <header className="settings-dialog__header">
            <h2 id="settings-title">Settings</h2>
            {onClose !== undefined && (
              <button type="button" aria-label="Close settings" onClick={onClose}>
                ×
              </button>
            )}
          </header>

          <fieldset>
            <legend>Timer</legend>
            {durationFields.map(({ key, label }) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={draft[key]}
                  onChange={(event) => updateDraft({ [key]: Number(event.currentTarget.value) })}
                />
              </label>
            ))}
            <label>
              <input
                type="checkbox"
                checked={draft.sequenceEnabled}
                onChange={(event) => updateDraft({ sequenceEnabled: event.currentTarget.checked })}
              />
              Enable Pomodoro cycle
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.autoStartNext}
                onChange={(event) => updateDraft({ autoStartNext: event.currentTarget.checked })}
              />
              Automatically start the next phase
            </label>
          </fieldset>

          <fieldset>
            <legend>Experience</legend>
            <label>
              Theme
              <select
                value={draft.theme}
                onChange={(event) => updateDraft({ theme: event.currentTarget.value as TimerSettings['theme'] })}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.soundEnabled}
                onChange={(event) => updateDraft({ soundEnabled: event.currentTarget.checked })}
              />
              Play a sound when the timer ends
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.notificationsEnabled}
                onChange={(event) => updateDraft({ notificationsEnabled: event.currentTarget.checked })}
              />
              Enable browser notifications
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.reducedMotion}
                onChange={(event) => updateDraft({ reducedMotion: event.currentTarget.checked })}
              />
              Reduce motion
            </label>
          </fieldset>

          {error !== null && <p role="alert">{error}</p>}
          {success !== null && (
            <p className="settings-success" role="status" aria-live="polite">
              {success}
            </p>
          )}

          <footer className="settings-dialog__actions">
            <button type="button" onClick={requestRestore}>
              Restore defaults
            </button>
            <button type="submit" disabled={isSaving}>
              Save settings
            </button>
          </footer>
        </form>

        {showRestoreConfirmation && (
          <section
            ref={confirmationRef}
            className="settings-dialog__confirmation"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="restore-title"
            onKeyDown={handleConfirmationKeyDown}
          >
            <h3 id="restore-title">Confirm restoring defaults</h3>
            <p>This will overwrite your current timer and experience settings.</p>
            <button ref={cancelRestoreRef} type="button" onClick={closeRestoreConfirmation}>
              Cancel
            </button>
            <button type="button" disabled={isSaving} onClick={() => void save({ ...defaultTimerSettings })}>
              Confirm restoring defaults
            </button>
          </section>
        )}
      </section>
    </div>
  )
}
