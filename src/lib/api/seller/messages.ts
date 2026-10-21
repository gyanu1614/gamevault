/**
 * Conversations and messages for the account inbox.
 *
 * Part of the browser seller API, split out of lib/api/seller-compatible.ts
 * (2026-10-20, files under ~400 lines). Import from '@/lib/api/seller-compatible'.
 */
import { supabase } from './client'
import type { Order, Message, Conversation } from './types'

// =====================================================
// MESSAGES API
// =====================================================


export const messagesApi = {
  /**
   * Get all conversations for current seller
   */
  async getConversations(): Promise<Conversation[]> {
    // Local session read, not a network getUser(): the id only builds the
    // filter below, and RLS on conversations/messages is the real gate.
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        buyer:profiles!buyer_id(id, username, avatar_url),
        seller:profiles!seller_id(id, username, avatar_url, is_verified),
        order:orders!order_id(
          id,
          order_number,
          status,
          total_amount,
          quantity,
          listing:listings!listing_id(
            id,
            title,
            images,
            game:game_id(id, name, slug, image_url),
            category:game_categories!listings_game_category_id_fkey(name, slug, type)
          )
        )
      `)
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false })

    if (error) throw error

    const convs = (data || []) as any[]
    const ids = convs.map((c) => c.id)

    // Last message per conversation (one small query each, in parallel) and
    // ALL unread counts in ONE query — was two queries per conversation.
    const [lastMsgs, unreadRes] = await Promise.all([
      Promise.all(
        ids.map((id) =>
          supabase
            .from('messages')
            .select('content, sender_id')
            .eq('conversation_id', id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle() as any,
        ),
      ),
      ids.length > 0
        ? (supabase
            .from('messages')
            .select('conversation_id')
            .in('conversation_id', ids)
            .eq('is_read', false)
            .neq('sender_id', user.id)
            .limit(5000) as any)
        : Promise.resolve({ data: [] }),
    ])
    const unread = new Map<string, number>()
    for (const row of ((unreadRes as any)?.data ?? []) as Array<{ conversation_id: string }>) {
      unread.set(row.conversation_id, (unread.get(row.conversation_id) ?? 0) + 1)
    }

    const conversationsWithDetails = convs.map((conv, i) => ({
      ...conv,
      last_message: (lastMsgs[i] as any)?.data ?? undefined,
      unread_count: unread.get(conv.id) ?? 0,
    }))

    return conversationsWithDetails
  },

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!sender_id(id, username, avatar_url)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  },

  /**
   * Send a message
   */
  async sendMessage(conversationId: string, content: string, attachments?: string[]): Promise<Message> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await (supabase
      .from('messages')
      .insert as any)({
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        attachments: attachments || [],
        is_read: false
      })
      .select()
      .single()

    if (error) throw error

    // Update conversation last_message_at
    await (supabase
      .from('conversations')
      .update as any)({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    return data
  },

  /**
   * Mark messages as read
   */
  async markAsRead(conversationId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await (supabase
      .from('messages')
      .update as any)({ is_read: true, read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .eq('is_read', false)

    if (error) throw error
  },

  /**
   * Create or get existing conversation with seller and send first message
   */
  async startConversation(sellerId: string, initialMessage: string): Promise<{ conversationId: string }> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if conversation already exists
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('buyer_id', user.id)
      .eq('seller_id', sellerId)
      .single() as any

    let conversationId = existingConv?.id

    // Create conversation if it doesn't exist
    if (!conversationId) {
      const { data: newConv, error: convError } = await (supabase
        .from('conversations')
        .insert as any)({
          buyer_id: user.id,
          seller_id: sellerId,
          last_message_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (convError) throw convError
      conversationId = newConv.id
    }

    // Send the initial message
    const { error: msgError } = await (supabase
      .from('messages')
      .insert as any)({
        conversation_id: conversationId,
        sender_id: user.id,
        content: initialMessage,
        is_read: false
      })

    if (msgError) throw msgError

    // Update conversation last_message_at
    await (supabase
      .from('conversations')
      .update as any)({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    return { conversationId }
  },

  /**
   * Get conversation by order ID
   */
  async getConversationByOrder(orderId: string): Promise<Conversation | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        buyer:profiles!buyer_id(id, username, avatar_url),
        seller:profiles!seller_id(id, username, avatar_url, is_verified),
        order:orders!order_id(
          id,
          order_number,
          status,
          total_amount,
          quantity,
          listing:listings!listing_id(
            id,
            title,
            images,
            game:game_id(name, slug, image_url),
            category:game_categories!listings_game_category_id_fkey(name, slug, type)
          )
        )
      `)
      .eq('order_id', orderId)
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }

    return data
  },

  /**
   * Get or create conversation for an order
   */
  async getOrCreateConversationByOrder(orderId: string): Promise<Conversation> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Check if conversation already exists
    const existing = await this.getConversationByOrder(orderId)
    if (existing) return existing

    // Get order details to create conversation
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        buyer_id,
        seller_id,
        listing_id,
        order_number,
        status,
        total_amount,
        listing:listings!listing_id(
          id,
          title,
          images
        )
      `)
      .eq('id', orderId)
      .single() as any

    if (orderError) throw orderError
    if (!order) throw new Error('Order not found')

    // Create conversation
    const { data: newConv, error: convError } = await (supabase
      .from('conversations')
      .insert as any)({
        buyer_id: order.buyer_id,
        seller_id: order.seller_id,
        listing_id: order.listing_id,
        order_id: orderId,
        last_message_at: new Date().toISOString()
      })
      .select(`
        *,
        buyer:profiles!buyer_id(id, username, avatar_url),
        seller:profiles!seller_id(id, username, avatar_url, is_verified),
        order:orders!order_id(
          id,
          order_number,
          status,
          total_amount,
          quantity,
          listing:listings!listing_id(
            id,
            title,
            images,
            game:game_id(name, slug, image_url),
            category:game_categories!listings_game_category_id_fkey(name, slug, type)
          )
        )
      `)
      .single()

    if (convError) throw convError

    // Send welcome message from seller
    const welcomeMessage = `Hi! Thank you for your purchase. I'll deliver your order shortly. Feel free to message me if you have any questions!`

    await (supabase
      .from('messages')
      .insert as any)({
        conversation_id: newConv.id,
        sender_id: order.seller_id,
        content: welcomeMessage,
        is_read: false
      })

    return newConv
  },

  /**
   * Send smart action message (auto-generated messages for order actions)
   */
  async sendSmartActionMessage(
    conversationId: string,
    action: 'delivered' | 'received' | 'disputed' | 'cancelled',
    customMessage?: string
  ): Promise<Message> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Generate message based on action
    const messageTemplates = {
      delivered: customMessage || "I've marked your order as delivered! Please check and confirm receipt when you receive it.",
      received: customMessage || "Order received! Thank you for a smooth transaction.",
      disputed: customMessage || "I've opened a dispute for this order. Please see the details.",
      cancelled: customMessage || "This order has been cancelled."
    }

    const content = messageTemplates[action]

    const { data, error } = await (supabase
      .from('messages')
      .insert as any)({
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        is_read: false
      })
      .select()
      .single()

    if (error) throw error

    // Update conversation last_message_at
    await (supabase
      .from('conversations')
      .update as any)({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    return data
  },
}
