import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'

describe('test harness', () => {
  it('renders React components in jsdom', () => {
    render(createElement('div', null, 'Focus Space'))

    expect(screen.getByText('Focus Space')).toBeInTheDocument()
  })

  it('starts each render with a clean DOM', () => {
    render(createElement('div', null, 'Fresh Render'))

    expect(screen.getByText('Fresh Render')).toBeInTheDocument()
    expect(screen.queryByText('Focus Space')).not.toBeInTheDocument()
  })
})
