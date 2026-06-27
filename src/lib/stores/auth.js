import { writable, get } from 'svelte/store';
import { supabase, supabaseEnabled } from '$lib/supabase';

/** Сессия Supabase (свой аккаунт сайта). null — не авторизован. */
export const siteSession = writable(null);
/** Профиль из таблицы profiles: { id, username, avatar_url } | null */
export const siteProfile = writable(null);
export const authReady = writable(!supabaseEnabled);

async function loadProfile(userId) {
	if (!supabase || !userId) {
		siteProfile.set(null);
		return;
	}
	const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
	siteProfile.set(data || null);
}

if (supabase) {
	supabase.auth.getSession().then(({ data }) => {
		siteSession.set(data.session);
		if (data.session) loadProfile(data.session.user.id);
		authReady.set(true);
	});
	supabase.auth.onAuthStateChange((_event, session) => {
		siteSession.set(session);
		loadProfile(session?.user?.id);
	});
}

/** Регистрация по email+пароль. Создаёт запись в profiles с username. */
export async function siteSignUp(email, password, username) {
	if (!supabase) throw new Error('Supabase не настроен');
	const { data, error } = await supabase.auth.signUp({
		email,
		password,
		options: { data: { username } }
	});
	if (error) throw error;
	// профиль создаётся триггером в БД; подстрахуемся upsert-ом, если сессия уже есть
	if (data.user && data.session) {
		await supabase.from('profiles').upsert({ id: data.user.id, username }).select();
		await loadProfile(data.user.id);
	}
	return data;
}

export async function siteSignIn(email, password) {
	if (!supabase) throw new Error('Supabase не настроен');
	const { data, error } = await supabase.auth.signInWithPassword({ email, password });
	if (error) throw error;
	return data;
}

export async function siteSignOut() {
	if (!supabase) return;
	await supabase.auth.signOut();
	siteSession.set(null);
	siteProfile.set(null);
}

/** Текущее отображаемое имя пользователя сайта (или null). */
export function currentSiteName() {
	const p = get(siteProfile);
	const s = get(siteSession);
	return p?.username || s?.user?.user_metadata?.username || s?.user?.email?.split('@')[0] || null;
}
