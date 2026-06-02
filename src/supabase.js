import { createClient } from '@supabase/supabase-js'

// ──────────────────────────────────────────────────────────────────
// SUPABASE CONFIGURATION
// ──────────────────────────────────────────────────────────────────
// To connect to your Supabase project:
// 1. Go to https://supabase.com → Create a free project
// 2. Go to Settings → API → Copy the "URL" and "anon public" key
// 3. Paste them below
// ──────────────────────────────────────────────────────────────────

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const isConfigured = 
  supabaseUrl && 
  supabaseUrl.startsWith('http') && 
  supabaseUrl !== 'YOUR_SUPABASE_URL' &&
  supabaseAnonKey && 
  supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY' &&
  supabaseAnonKey !== 'YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY' &&
  !supabaseAnonKey.startsWith('sb_secret_')

export const supabaseConfigError = supabaseAnonKey.startsWith('sb_secret_')
  ? 'Your Supabase key is a secret key. Use a publishable key or legacy anon key for browser sign-in.'
  : ''

export const isSupabaseConfigured = Boolean(isConfigured)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        persistSession: true,
      },
    })
  : null
