import { createClient } from '@supabase/supabase-js';

// Pastikan Anda sudah menambahkan variabel ini di file .env.local Anda
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ PERINGATAN KEMITRAAN SUPABASE: VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY belum di-set di file .env.local Anda!");
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');
