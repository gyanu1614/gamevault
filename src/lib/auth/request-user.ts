import 'server-only'
import * as React from 'react'
import type { User } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/server'

/**
 * The signed-in user for THIS server request, asked of Supabase Auth once.
 *
 * `auth.getUser()` is a network call to the auth server every time; a route
 * whose layout, page and loaders each asked paid that round trip three or four
 * times per render (the sell edit page did). React cache() collapses them to
 * one per request. Server components and server-side loaders only; a server
 * action invoked from the browser is its own request and asks once.
 */
// Next's server React provides cache(); plain React 18 (unit tests) does not,
// and there each call simply asks once.
const perRequest: <F extends (...args: never[]) => unknown>(fn: F) => F =
  (React as unknown as { cache?: <F>(fn: F) => F }).cache ?? ((fn) => fn)

export const getRequestUser = perRequest(async (): Promise<User | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  return error ? null : data.user
})
