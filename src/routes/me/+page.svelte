<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { userToken, showToast } from '$lib/stores';
	import { siteSession, siteProfile, authReady, refreshProfile } from '$lib/stores/auth';
	import { counts, updateProfile } from '$lib/sitedata';
	import Icon from '$lib/components/Icon.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	let stats = {};
	let loading = true;
	let editing = false;
	let username = '';
	let avatar = '';
	let saving = false;

	$: profile = $siteProfile;
	$: email = $siteSession?.user?.email || '';

	const cards = [
		{ key: 1, label: 'Смотрю', href: '/bookmarks?type=1', cls: 'watching' },
		{ key: 2, label: 'В планах', href: '/bookmarks?type=2', cls: 'plan' },
		{ key: 3, label: 'Просмотрено', href: '/bookmarks?type=3', cls: 'completed' },
		{ key: 4, label: 'Отложено', href: '/bookmarks?type=4', cls: 'hold' },
		{ key: 5, label: 'Брошено', href: '/bookmarks?type=5', cls: 'dropped' },
		{ key: 'fav', label: 'Избранное', href: '/bookmarks?type=fav', cls: 'fav' },
		{ key: 'rated', label: 'Оценки', href: '/me', cls: 'rated' },
		{ key: 'hist', label: 'История', href: '/history', cls: 'hist' }
	];

	async function loadStats() {
		loading = true;
		stats = await counts();
		loading = false;
	}

	function startEdit() {
		username = profile?.username || '';
		avatar = profile?.avatar_url || '';
		editing = true;
	}
	async function save() {
		if (!username.trim()) return showToast('Имя не может быть пустым', 'error');
		saving = true;
		try {
			await updateProfile({ username: username.trim(), avatar_url: avatar.trim() || null });
			await refreshProfile();
			editing = false;
			showToast('Профиль обновлён', 'success');
		} catch {
			showToast('Ошибка сохранения', 'error');
		}
		saving = false;
	}

	// site-аккаунт только; если вошёл Anixart — у него свой /profile
	let booted = false;
	$: if ($authReady && !booted) {
		booted = true;
		if ($userToken) goto(`/profile/${$userToken.id}`);
		else if (!$siteSession) goto('/login');
		else loadStats();
	}

	onMount(() => {
		if ($siteSession) loadStats();
	});
</script>

<svelte:head><title>Профиль — AniShiki</title></svelte:head>

<div class="page">
	{#if !$authReady}
		<Spinner center label="Загрузка…" />
	{:else if $siteSession}
		<div class="head">
			<div class="ava">
				{#if profile?.avatar_url}
					<img src={profile.avatar_url} alt="" referrerpolicy="no-referrer" />
				{:else}
					<Icon name="user" size={40} />
				{/if}
			</div>
			<div class="who">
				<h1>{profile?.username || 'Профиль'}</h1>
				<span class="email">{email}</span>
				<span class="badge">Аккаунт AniShiki</span>
			</div>
			<button class="edit" on:click={startEdit}><Icon name="settings" size={16} /> Изменить</button>
		</div>

		{#if editing}
			<div class="editor">
				<label>Имя
					<input bind:value={username} maxlength="40" placeholder="Имя пользователя" />
				</label>
				<label>Ссылка на аватар
					<input bind:value={avatar} placeholder="https://…" />
				</label>
				<div class="row">
					<button class="btn ghost" on:click={() => (editing = false)}>Отмена</button>
					<button class="btn primary" on:click={save} disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</button>
				</div>
			</div>
		{/if}

		<h2>Моя статистика</h2>
		{#if loading}
			<Spinner size={28} />
		{:else}
			<div class="grid">
				{#each cards as c}
					<a class="stat {c.cls}" href={c.href}>
						<span class="n">{stats[c.key] || 0}</span>
						<span class="l">{c.label}</span>
					</a>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.page {
		max-width: 1000px;
		margin: 0 auto;
		padding: 24px;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 18px;
		margin-bottom: 24px;
	}
	.ava {
		width: 88px;
		height: 88px;
		min-width: 88px;
		border-radius: 50%;
		overflow: hidden;
		display: grid;
		place-items: center;
		background: var(--elevated-color);
		color: var(--third-text-color);
	}
	.ava img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.who {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.who h1 {
		font-size: 26px;
		font-weight: 800;
	}
	.email {
		color: var(--secondary-text-color);
		font-size: 14px;
	}
	.badge {
		align-self: flex-start;
		margin-top: 4px;
		padding: 3px 10px;
		border-radius: 20px;
		font-size: 11.5px;
		font-weight: 700;
		color: var(--primary-color);
		background: color-mix(in srgb, var(--primary-color) 16%, transparent);
	}
	.edit {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 9px 14px;
		border: 1px solid var(--glass-border);
		background: var(--elevated-color);
		color: var(--text-color);
		border-radius: 10px;
		cursor: pointer;
		font-weight: 600;
		font-size: 13px;
	}
	.edit:hover {
		border-color: var(--primary-color);
	}
	.editor {
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		border-radius: 14px;
		padding: 16px;
		margin-bottom: 24px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.editor label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 13px;
		color: var(--secondary-text-color);
	}
	.editor input {
		padding: 11px 14px;
		border-radius: 10px;
		border: 1px solid var(--glass-border);
		background: var(--background-color);
		color: var(--text-color);
		font-size: 14px;
	}
	.editor .row {
		display: flex;
		gap: 10px;
		justify-content: flex-end;
	}
	.btn {
		padding: 10px 18px;
		border-radius: 10px;
		border: none;
		cursor: pointer;
		font-weight: 600;
		font-size: 14px;
	}
	.btn.primary {
		background: var(--primary-color);
		color: #fff;
	}
	.btn.primary:disabled {
		opacity: 0.6;
	}
	.btn.ghost {
		background: transparent;
		border: 1px solid var(--glass-border);
		color: var(--text-color);
	}
	h2 {
		font-size: 16px;
		font-weight: 700;
		margin-bottom: 14px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 12px;
	}
	.stat {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 18px;
		border-radius: 14px;
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		border-left: 3px solid var(--glass-border);
		color: inherit;
		transition: transform 0.15s ease;
	}
	.stat:hover {
		transform: translateY(-3px);
	}
	.stat .n {
		font-size: 26px;
		font-weight: 800;
	}
	.stat .l {
		font-size: 13px;
		color: var(--secondary-text-color);
	}
	.stat.watching {
		border-left-color: var(--watching-color);
	}
	.stat.plan {
		border-left-color: var(--plan-color);
	}
	.stat.completed {
		border-left-color: var(--completed-color);
	}
	.stat.hold {
		border-left-color: var(--hold-on-color);
	}
	.stat.dropped {
		border-left-color: var(--dropped-color);
	}
	.stat.fav,
	.stat.rated {
		border-left-color: var(--primary-color);
	}
	@media (max-width: 768px) {
		.page {
			padding: 16px 12px;
		}
	}
</style>
