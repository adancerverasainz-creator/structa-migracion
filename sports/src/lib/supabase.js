import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://wzzdwsggsefxeoniafhb.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_yNfm_t_fSKj9IejbJN0D_w_ChYnFTDp'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
