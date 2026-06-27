import { createClient } from '@supabase/supabase-js';
import { browser } from '$app/environment';

// Ключи можно переопределить через переменные окружения Vite (.env / Vercel env):
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
// По умолчанию — публичные значения проекта. Anon-ключ по дизайну публичный
// (он всё равно инлайнится в клиентский бандл), данные защищены через RLS.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://ardxekxefxzrycmqcrnf.supabase.co';
const anonKey =
	import.meta.env.VITE_SUPABASE_ANON_KEY ||
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyZHhla3hlZnh6cnljbXFjcm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NzE0MDgsImV4cCI6MjA4MjM0NzQwOH0.YsZkF_c_34NDcCYfavcfyUUPJTX6pt8ZYUu0yLDaalg';

/** Настроен ли Supabase (есть оба ключа). Фичи аккаунта/совместного просмотра включаются только тогда. */
export const supabaseEnabled = Boolean(url && anonKey);

/** Клиент Supabase или null, если ключи не заданы. */
export const supabase =
	supabaseEnabled && browser
		? createClient(url, anonKey, {
				auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
		  })
		: null;
