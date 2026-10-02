/** The slice of `fetch` the GSC tooling uses — injected so tests never reach Google. */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

export interface Clock {
  now: () => number
  sleep: (ms: number) => Promise<void>
}

export const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}
