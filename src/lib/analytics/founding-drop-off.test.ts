import { describe, expect, it, vi } from 'vitest'
import { createFoundingExit, type FoundingExitState } from './founding-drop-off'

function setup(initial: Partial<FoundingExitState> = {}) {
  const state: FoundingExitState = { step: 2, signedIn: true, finished: false, ...initial }
  const send = vi.fn()
  let clock = 1_000_000
  const exit = createFoundingExit(() => state, send, () => clock)
  return { state, send, exit, advance: (ms: number) => { clock += ms } }
}

describe('createFoundingExit', () => {
  it('reports the unfinished step, whether they had an account, and the seconds spent', () => {
    const { exit, send, advance } = setup({ step: 3 })
    advance(42_400)
    exit.left()
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith({ step: 3, signed_in: true, seconds: 42 })
  })

  it('reads the step at the moment they leave, not when the page opened', () => {
    const { exit, send, state } = setup({ step: 2 })
    state.step = 4
    exit.left()
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ step: 4 }))
  })

  it('sends nothing once the store is open', () => {
    const { exit, send, state } = setup()
    state.finished = true
    exit.left()
    expect(send).not.toHaveBeenCalled()
  })

  it('counts one exit even when the page hide and the unmount both fire', () => {
    const { exit, send } = setup()
    exit.left()
    exit.left()
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('counts a second exit after they come back from the browser back button', () => {
    const { exit, send, state } = setup({ step: 2 })
    exit.left()
    exit.returned()
    state.step = 3
    exit.left()
    expect(send).toHaveBeenCalledTimes(2)
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ step: 3 }))
  })
})
