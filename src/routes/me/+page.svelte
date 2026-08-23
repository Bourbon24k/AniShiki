<script>
	/**
	 * Свой профиль аккаунта сайта.
	 *
	 * Раньше это была отдельная страница со своей статистикой и списками.
	 * Теперь профиль сайта живёт по адресу /u/<id> и по возможностям совпадает
	 * с профилем Anixart, поэтому /me осталось только переадресацией — старые
	 * ссылки и закладки продолжают работать.
	 */
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { siteSession, authReady } from '$lib/stores/auth';
	import Spinner from '$lib/components/Spinner.svelte';

	onMount(() => {
		const unsubscribe = authReady.subscribe((ready) => {
			if (!ready) return;
			const id = $siteSession?.user?.id;
			goto(id ? `/u/${id}` : '/login', { replaceState: true });
		});
		return unsubscribe;
	});
</script>

<Spinner center label="Открываем профиль…" />
