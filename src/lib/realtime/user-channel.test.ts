import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// The channel manager joins through the browser client; fake just enough of it.
const bindings: ((msg: unknown) => void)[] = []
const statusCallbacks: ((status: string) => void)[] = []
const removeChannel = vi.fn()
const channelNames: string[] = []

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) },
    realtime: { setAuth: vi.fn() },
    removeChannel,
    channel: (name: string) => {
      channelNames.push(name)
      const ch = {
        on: (_type: string, _filter: unknown, cb: (msg: unknown) => void) => {
          bindings.push(cb)
          return ch
        },
        subscribe: (cb: (status: string) => void) => {
          statusCallbacks.push(cb)
          return ch
        },
      }
      return ch
    },
  }),
}))

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('user channel', () => {
  beforeEach(() => {
    vi.resetModules()
    bindings.length = 0
    statusCallbacks.length = 0
    channelNames.length = 0
    removeChannel.mockClear()
  })
  afterEach(() => vi.useRealTimers())

  it('parses only known events with an object payload', async () => {
    const { parseUserChannelMessage } = await import('./user-channel')
    expect(parseUserChannelMessage({ event: 'message', payload: { id: 'm' } })).toEqual({ event: 'message', payload: { id: 'm' } })
    expect(parseUserChannelMessage({ event: 'nope', payload: {} })).toBeNull()
    expect(parseUserChannelMessage({ event: 'order', payload: 'x' })).toBeNull()
    expect(parseUserChannelMessage(null)).toBeNull()
  })

  it('joins ONE private topic per user however many listeners, and routes by event', async () => {
    const { subscribeUserChannel } = await import('./user-channel')
    const onMessage = vi.fn()
    const onOrder = vi.fn()
    const offA = subscribeUserChannel('u1', 'message', onMessage)
    const offB = subscribeUserChannel('u1', 'order', onOrder)
    await flush()
    expect(channelNames).toEqual(['user:u1'])
    bindings[0]({ event: 'message', payload: { id: 'm1' } })
    bindings[0]({ event: 'order', payload: { order_id: 'o1' } })
    expect(onMessage).toHaveBeenCalledWith({ id: 'm1' })
    expect(onOrder).toHaveBeenCalledWith({ order_id: 'o1' })
    offA()
    offB()
  })

  it('reports re-joins, not the first join', async () => {
    const { onUserChannelRejoined } = await import('./user-channel')
    const rejoined = vi.fn()
    const off = onUserChannelRejoined('u1', rejoined)
    await flush()
    statusCallbacks[0]('SUBSCRIBED')
    expect(rejoined).not.toHaveBeenCalled()
    statusCallbacks[0]('CHANNEL_ERROR')
    statusCallbacks[0]('SUBSCRIBED')
    expect(rejoined).toHaveBeenCalledTimes(1)
    off()
  })

  it('leaves the channel only after the last listener has been gone for the grace period', async () => {
    vi.useFakeTimers()
    const { subscribeUserChannel, USER_CHANNEL_CLOSE_GRACE_MS } = await import('./user-channel')
    const off = subscribeUserChannel('u1', 'message', () => {})
    await vi.runAllTimersAsync()
    off()
    // A new page subscribing within the grace keeps the same channel.
    const again = subscribeUserChannel('u1', 'message', () => {})
    await vi.advanceTimersByTimeAsync(USER_CHANNEL_CLOSE_GRACE_MS + 10)
    expect(removeChannel).not.toHaveBeenCalled()
    expect(channelNames).toEqual(['user:u1'])
    again()
    await vi.advanceTimersByTimeAsync(USER_CHANNEL_CLOSE_GRACE_MS + 10)
    expect(removeChannel).toHaveBeenCalledTimes(1)
  })

  it('a different user (sign-out / sign-in) gets a fresh channel', async () => {
    const { subscribeUserChannel } = await import('./user-channel')
    const offA = subscribeUserChannel('u1', 'message', () => {})
    await flush()
    const offB = subscribeUserChannel('u2', 'message', () => {})
    await flush()
    expect(channelNames).toEqual(['user:u1', 'user:u2'])
    expect(removeChannel).toHaveBeenCalledTimes(1)
    offA()
    offB()
  })
})
