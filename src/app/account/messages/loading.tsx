import { ChatMessageSkeleton } from '@/components/ui/skeletons'

export default function MessagesLoading() {
  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-2xl overflow-hidden border border-white/[0.08] bg-white/[0.02]">
      {/* Conversation list */}
      <div className="w-72 shrink-0 border-r border-white/[0.06] p-3 space-y-2">
        <div className="skeleton h-9 w-full rounded-xl mb-3" />
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2 rounded-xl">
            <div className="skeleton h-10 w-10 rounded-full shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="skeleton h-3 w-24 rounded" />
              <div className="skeleton h-3 w-32 rounded" />
            </div>
          </div>
        ))}
      </div>
      {/* Chat area */}
      <div className="flex-1 flex flex-col p-4 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <ChatMessageSkeleton key={i} right={i % 3 === 0} />
        ))}
      </div>
    </div>
  )
}
