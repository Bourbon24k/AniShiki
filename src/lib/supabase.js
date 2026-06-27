import { createClient } from '@supabase/supabase-js';
import { browser } from '$app/environment';

// Ключи задаются через переменные окружения Vite (.env / Vercel env):
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Настроен ли Supabase (есть оба ключа). Фичи аккаунта/совместного просмотра включаются только тогда. */
export const supabaseEnabled = Boolean(url && anonKey);

/** Клиент Supabase или null, если ключи не заданы. */
export const supabase =
	supabaseEnabled && browser
		? createClient(url, anonKey, {
				auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
		  })
		: null;
