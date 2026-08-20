import { createClient } from '@supabase/supabase-js';
import { browser } from '$app/environment';

// Ключи можно переопределить через переменные окружения Vite (.env / Vercel env):
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
// По умолчанию — отдельный проект AniShiki (база VPN-бота живёт в другом
// проекте и с этим не пересекается). Anon-ключ по дизайну публичный
// (он всё равно инлайнится в клиентский бандл), данные защищены через RLS.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://zvvxrleubfqwnxcgzasy.supabase.co';
const anonKey =
	import.meta.env.VITE_SUPABASE_ANON_KEY ||
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2dnhybGV1YmZxd254Y2d6YXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNTk5OTcsImV4cCI6MjEwMjgzNTk5N30.mDIEHFvFa-VGIWMMCy-nlZ1amMYziNUbCg-YJ7uY1lg';

/** Настроен ли Supabase (есть оба ключа). Фичи аккаунта/совместного просмотра включаются только тогда. */
export const supabaseEnabled = Boolean(url && anonKey);

/** Клиент Supabase или null, если ключи не заданы. */
export const supabase =
	supabaseEnabled && browser
		? createClient(url, anonKey, {
				auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
		  })
		: null;
