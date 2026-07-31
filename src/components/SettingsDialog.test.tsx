import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  defaultTimerSettings,
  type DailyFocusSummary,
  type FocusRepositories,
  type TimerSettings,
  type TimerSession,
} from '../storage/repositories'
import { createFocusStore } from '../store/useFocusStore'
import { SettingsDialog } from './SettingsDialog'

function createStore(initialSettings: TimerSettings = defaultTimerSettings) {
  let savedSettings = { ...initialSettings }
  const repositories: FocusRepositories = {
    settings: {
      load: async () => ({ ...savedSettings }),
      save: async (settings) => {
        savedSettings = { ...settings }
      },
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

  return {
    store: createFocusStore({ repositories, now: () => 1_000 }),
    savedSettings: () => savedSettings,
  }
}

describe('SettingsDialog', () => {
  it('saves a focus duration of 50 minutes', async () => {
    const { store, savedSettings } = createStore()

    render(<SettingsDialog store={store} />)

    expect(screen.getByRole('dialog', { name: '设置' })).toBeVisible()
    fireEvent.change(screen.getByLabelText('专注时长（分钟）'), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: '保存设置' }))

    await waitFor(() => expect(store.getState().settings.focusMinutes).toBe(50))
    expect(savedSettings().focusMinutes).toBe(50)
  })

  it('saves the browser notification preference', async () => {
    const { store, savedSettings } = createStore()

    render(<SettingsDialog store={store} />)

    fireEvent.click(screen.getByLabelText('启用浏览器通知'))
    fireEvent.click(screen.getByRole('button', { name: '保存设置' }))

    await waitFor(() => expect(savedSettings()).toMatchObject({ notificationsEnabled: false }))
    expect(store.getState().settings).toMatchObject({ notificationsEnabled: false })
  })

  it('shows a success message and stays open after saving settings', async () => {
    const { store } = createStore()
    const onClose = vi.fn()

    render(<SettingsDialog store={store} onClose={onClose} />)

    fireEvent.change(screen.getByLabelText('专注时长（分钟）'), { target: { value: '26' } })
    fireEvent.click(screen.getByRole('button', { name: '保存设置' }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('设置已保存'))
    expect(screen.getByRole('dialog', { name: '设置' })).toBeVisible()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('requires confirmation before restoring default settings', async () => {
    const customSettings: TimerSettings = {
      ...defaultTimerSettings,
      focusMinutes: 50,
      theme: 'dark',
    }
    const { store, savedSettings } = createStore()
    await store.getState().saveSettings(customSettings)

    render(<SettingsDialog store={store} />)

    fireEvent.click(screen.getByRole('button', { name: '恢复默认设置' }))
    expect(screen.getByRole('alertdialog', { name: '确认恢复默认设置' })).toBeVisible()
    expect(store.getState().settings.focusMinutes).toBe(50)

    fireEvent.click(screen.getByRole('button', { name: '确认恢复默认设置' }))

    await waitFor(() => expect(store.getState().settings).toEqual(defaultTimerSettings))
    expect(savedSettings()).toEqual(defaultTimerSettings)
  })

  it('focuses, traps and restores focus for restore confirmation', () => {
    const { store } = createStore()
    const onClose = vi.fn()

    render(<SettingsDialog store={store} onClose={onClose} />)

    const closeButton = screen.getByRole('button', { name: '关闭设置' })
    expect(closeButton).toHaveFocus()

    const restoreButton = screen.getByRole('button', { name: '恢复默认设置' })
    restoreButton.focus()
    fireEvent.click(restoreButton)

    const confirmation = screen.getByRole('alertdialog', { name: '确认恢复默认设置' })
    const cancelButton = screen.getByRole('button', { name: '取消' })
    const confirmButton = screen.getByRole('button', { name: '确认恢复默认设置' })
    expect(cancelButton).toHaveFocus()

    confirmButton.focus()
    fireEvent.keyDown(confirmation, { key: 'Tab' })
    expect(cancelButton).toHaveFocus()

    fireEvent.keyDown(confirmation, { key: 'Escape' })
    expect(confirmation).not.toBeInTheDocument()
    expect(restoreButton).toHaveFocus()
  })
})
