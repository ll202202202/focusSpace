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
  { key: 'focusMinutes', label: '专注时长（分钟）' },
  { key: 'shortBreakMinutes', label: '短休息时长（分钟）' },
  { key: 'longBreakMinutes', label: '长休息时长（分钟）' },
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
      setSuccess('设置已保存')
    } catch (error) {
      console.error('Failed to save Focus Space settings', error)
      setError('设置保存失败，请重试。')
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
            <h2 id="settings-title">设置</h2>
            {onClose !== undefined && (
              <button type="button" aria-label="关闭设置" onClick={onClose}>
                ×
              </button>
            )}
          </header>

          <fieldset>
            <legend>计时</legend>
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
              启用番茄钟序列
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.autoStartNext}
                onChange={(event) => updateDraft({ autoStartNext: event.currentTarget.checked })}
              />
              自动开始下一阶段
            </label>
          </fieldset>

          <fieldset>
            <legend>体验</legend>
            <label>
              主题
              <select
                value={draft.theme}
                onChange={(event) => updateDraft({ theme: event.currentTarget.value as TimerSettings['theme'] })}
              >
                <option value="system">跟随系统</option>
                <option value="light">浅色</option>
                <option value="dark">深色</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.soundEnabled}
                onChange={(event) => updateDraft({ soundEnabled: event.currentTarget.checked })}
              />
              完成时播放提示音
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.notificationsEnabled}
                onChange={(event) => updateDraft({ notificationsEnabled: event.currentTarget.checked })}
              />
              启用浏览器通知
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.reducedMotion}
                onChange={(event) => updateDraft({ reducedMotion: event.currentTarget.checked })}
              />
              减少动态效果
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
              恢复默认设置
            </button>
            <button type="submit" disabled={isSaving}>
              保存设置
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
            <h3 id="restore-title">确认恢复默认设置</h3>
            <p>这会覆盖当前的计时和体验设置。</p>
            <button ref={cancelRestoreRef} type="button" onClick={closeRestoreConfirmation}>
              取消
            </button>
            <button type="button" disabled={isSaving} onClick={() => void save({ ...defaultTimerSettings })}>
              确认恢复默认设置
            </button>
          </section>
        )}
      </section>
    </div>
  )
}
