import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CustomerManager } from './customer-form'

describe('CustomerManager', () => {
  it('allows the maximum-length username to wrap in the customer list', () => {
    const username = 'a'.repeat(64)
    const markup = renderToStaticMarkup(
      createElement(CustomerManager, {
        initialCustomers: [{
          id: 'customer-1',
          name: 'Customer Example',
          username,
          createdAt: new Date().toISOString(),
        }],
      }),
    )

    expect(markup).toContain(`@${username}`)
    expect(markup).toContain('wrap-anywhere')
  })
})
