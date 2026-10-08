import { createClient } from '@supabase/supabase-js'

// Not: import.meta.env.VITE_* doğrudan erişim bilinçli bir tercihtir —
// Vite bu ifadeleri build anında statik değerle değiştirir. Böylece env
// tanımlı değilse supabase-js bundle'dan tamamen elenir (ölü kod elemesi).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Ortam değişkenleri girilmemişse uygulama "yerel modda" çalışır
// (veriler yalnızca bu tarayıcıda saklanır). Girilmişse Supabase kullanılır.
export const supabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null
