import { describe, it, expect, vi } from 'vitest'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.stubGlobal('React', React)

import { DiscordJoin } from './DiscordJoin'
import { DISCORD_INVITE_URL } from '@/lib/config/social'

// Owner, 2026-10-14: besides the username, offer joining our Discord "in a nice design".
describe('DiscordJoin', () => {
  it('links to our Discord invite in a new tab, safely', () => {
    const html = renderToStaticMarkup(createElement(DiscordJoin))
    expect(html).toContain(`href="${DISCORD_INVITE_URL}"`)
    expect(html).toContain('target="_blank"')
    expect(html).toMatch(/rel="noopener noreferrer"/)
    expect(html).toContain('Join Our Discord')
  })
})
