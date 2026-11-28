import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { Calendar } from './calendar'

it('renders month navigation as labeled buttons with decorative icons', () => {
  const html = renderToStaticMarkup(createElement(Calendar, {
    defaultMonth: new Date(2026, 10, 1),
    labels: { labelPrevious: () => 'Earlier month', labelNext: () => 'Later month' },
  }))
  for (const label of ['Earlier month', 'Later month']) {
    expect(html).toMatch(new RegExp('<button[^>]*aria-label="' + label + '"[^>]*><svg[^>]*aria-hidden="true"'))
  }
})
