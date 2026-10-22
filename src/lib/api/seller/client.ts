/**
 * The browser seller API's shared client. Split out of
 * lib/api/seller-compatible.ts (2026-10-20).
 */
import { createClient } from '@/lib/supabase/client'

export const supabase = createClient()
