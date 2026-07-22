/**
 * TeamMessages — the seller's message channel with the DropMarket team, shown
 * on the Application Status page as a floating chat bubble (bottom-right,
 * thumb-friendly on mobile) with an unread badge. Opens a small chat modal:
 * team messages left (ivory), the seller's replies right (forest), input +
 * send at the bottom. Auto-opens when the page is reached with
 * ?openMessages=1 (the deep link admin messages carry). Mobile: the panel
 * becomes a bottom sheet; desktop: a bottom-right anchored card.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageSquare, Send, X, Loader2 } from 'lucide-react'
import {
  getTeamThread,
  sendMessageToTeam,
  markTeamThreadRead,
  type TeamThreadMessage,
} from '@/lib/actions/seller-messages'

const P = {
  paper: '#FFFFFF',
  ivory: '#FAFAF7',
  forest: '#14432A',
  forest2: '#1B5E3A',
  forest3: '#0F3320',
  lime: '#A3E635',
  ink: '#1A1D19',
  ink2: '#5B6157',
  line: '#E4E5DE',
}

export default function TeamMessages() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<TeamThreadMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const unread = messages.filter((m) => m.from === 'team' && !m.read).length

  const refresh = useCallback(async () => {
    const res = await getTeamThread()
    if (res.success) setMessages(res.messages)
    setLoaded(true)
  }, [])

  useEffect(() => {
    void refresh()
    // Deep link from the bell notification: auto-open the chat.
    const params = new URLSearchParams(window.location.search)
    if (params.get('openMessages') === '1') {
      setOpen(true)
      window.history.replaceState(null, '', '/account/seller-status')
    }
  }, [refresh])

  // Opening the chat marks the team's messages read.
  useEffect(() => {
    if (!open) return
    void markTeamThreadRead().then(() =>
      setMessages((prev) => prev.map((m) => (m.from === 'team' ? { ...m, read: true } : m))),
    )
  }, [open])

  // Keep the newest message in view.
  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [open, messages.length])

  const handleSend = async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    const optimistic: TeamThreadMessage = {
      id: `tmp-${messages.length}`,
      from: 'me',
      body: text,
      at: new Date().toISOString(),
      read: true,
    }
    setMessages((prev) => [...prev, optimistic])
    setDraft('')
    const res = await sendMessageToTeam(text)
    setSending(false)
    if (!res.success) {
      // Roll the optimistic bubble back and restore the draft.
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setDraft(text)
    }
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })

  return (
    <>
      {/* Floating bubble — bottom-right, thumb reachable on mobile. Keep a
          small safe-area breathing room on phones; lg+ keeps bottom-5. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Messages from the DropMarket team"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+20px)] right-5 z-40 grid h-14 w-14 place-items-center rounded-full transition-transform hover:scale-105 lg:bottom-5"
        style={{
          backgroundColor: P.forest,
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.18), 0 12px 28px -10px rgba(0,0,0,0.55)',
        }}
      >
        <MessageSquare className="h-6 w-6 text-white" />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 grid min-w-[22px] place-items-center rounded-full px-1.5 py-0.5 text-[11px] font-black"
            style={{ backgroundColor: P.lime, color: P.forest3 }}
          >
            {unread}
          </span>
        )}
      </button>

      {/* Chat panel — bottom sheet on mobile, anchored card on sm+ */}
      {open && (
        <div className="fixed inset-0 z-50">
          <button
            aria-label="Close messages"
            onClick={() => setOpen(false)}
            className="animate-fade-in absolute inset-0 cursor-default"
            style={{ backgroundColor: 'rgba(15,51,32,0.45)', backdropFilter: 'blur(2px)' }}
          />
          <div
            className="animate-fade-up absolute inset-x-2 bottom-2 flex max-h-[78vh] flex-col overflow-hidden rounded-2xl shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[380px] sm:max-h-[70vh]"
            style={{ backgroundColor: P.paper }}
            role="dialog"
            aria-label="Messages from the DropMarket team"
          >
            {/* Header */}
            <div
              className="flex shrink-0 items-center justify-between px-4 py-3.5"
              style={{
                background: `linear-gradient(180deg, ${P.forest2} 0%, ${P.forest} 100%)`,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14)',
              }}
            >
              <div className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/logo-mark-white.png"
                  alt=""
                  width={22}
                  height={22}
                  className="h-[22px] w-[22px] object-contain"
                />
                <div>
                  <p className="text-[13.5px] font-bold text-white">DropMarket Team</p>
                  <p className="text-[10.5px] text-white/60">About your seller application</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-white/10"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>

            {/* Thread */}
            <div
              ref={scrollRef}
              className="min-h-[180px] flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3.5"
              style={{ backgroundColor: P.ivory }}
            >
              {!loaded ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: P.forest2 }} />
                </div>
              ) : messages.length === 0 ? (
                <p className="px-4 py-8 text-center text-[12.5px]" style={{ color: P.ink2 }}>
                  No messages yet. Questions about your application? Write to us
                  below — the review team answers here.
                </p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={m.from === 'me' ? 'flex justify-end' : 'flex justify-start'}
                  >
                    <div
                      className="max-w-[82%] rounded-2xl px-3.5 py-2.5"
                      style={
                        m.from === 'me'
                          ? {
                              backgroundColor: P.forest,
                              color: '#FFFFFF',
                              borderBottomRightRadius: 6,
                            }
                          : {
                              backgroundColor: P.paper,
                              color: P.ink,
                              border: `1px solid ${P.line}`,
                              borderBottomLeftRadius: 6,
                            }
                      }
                    >
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{m.body}</p>
                      <p
                        className="mt-1 text-right text-[10px]"
                        style={{ color: m.from === 'me' ? 'rgba(255,255,255,0.55)' : P.ink2 }}
                      >
                        {fmt(m.at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Composer */}
            <div
              className="flex shrink-0 items-end gap-2 border-t px-3 py-3"
              style={{ borderColor: P.line, backgroundColor: P.paper }}
            >
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSend()
                  }
                }}
                rows={1}
                maxLength={500}
                placeholder="Write a message…"
                className="max-h-28 min-h-[44px] flex-1 resize-none rounded-xl border px-3.5 py-2.5 text-[13px] outline-none"
                style={{ borderColor: P.line, color: P.ink, backgroundColor: P.ivory }}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !draft.trim()}
                aria-label="Send"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-transform hover:scale-105 disabled:opacity-50"
                style={{
                  backgroundColor: P.lime,
                  color: P.forest3,
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -2px 0 rgba(0,0,0,0.12)',
                }}
              >
                {sending ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                ) : (
                  <Send className="h-[18px] w-[18px]" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
