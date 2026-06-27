<script>
	import { goto } from '$app/navigation';
	import { guiSettings, endpointUrl, playingSettings, userToken, notificationCount, showToast } from '$lib/stores';
	import { reinitApi } from '$lib/api';
	import { themeValues, endpointValues, sourceValues, qualityValues } from '$lib/utils';
	import { supabaseEnabled } from '$lib/supabase';
	import { siteSession, siteProfile, siteSignOut, currentSiteName } from '$lib/stores/auth';
	import Icon from '$lib/components/Icon.svelte';

	async function siteLogout() {
		await siteSignOut();
		showToast('Вы вышли из аккаунта AniShiki', 'info');
	}

	function setTheme(t) {
		guiSettings.update((s) => ({ ...s, theme: t }));
	}
	function setEndpoint(v) {
		endpointUrl.set(v);
		reinitApi();
		showToast('Сервер изменён', 'success');
	}
	function setSource(v) {
		playingSettings.update((s) => ({ ...s, defaultSource: v }));
	}
	function setQuality(v) {
		playingSettings.update((s) => ({ ...s, defaultQuality: v }));
	}
	function toggleHistory() {
		playingSettings.update((s) => ({ ...s, disableHistory: !s.disableHistory }));
	}
	function logout() {
		userToken.set(null);
		notificationCount.set(0);
		reinitApi();
		showToast('Вы вышли', 'info');
		goto('/');
	}
</script>

<svelte:head><title>Настройки — AniShiki</title></svelte:head>

<div class="page">
	<div class="inner">
		<h1>Настройки</h1>

		{#if $userToken}
			<section class="card">
				<a class="account" href={`/profile/${$userToken.id}`}>
					<div class="ava">
						{#if $userToken.avatar}<img src={$userToken.avatar} alt="" referrerpolicy="no-referrer" />{:else}<Icon name="user" size={26} />{/if}
					</div>
					<div>
						<span class="login">{$userToken.login}</span>
						<span class="sub">Открыть профиль</span>
					</div>
					<Icon name="chevronRight" size={20} />
				</a>
				<button class="logout" on:click={logout}>Выйти из аккаунта</button>
			</section>
		{:else}
			<section class="card">
				<a class="login-cta" href="/login">Войти в аккаунт Anixart</a>
			</section>
		{/if}

		{#if supabaseEnabled}
			<section class="card">
				<h2 class="card-title">Аккаунт AniShiki</h2>
				{#if $siteSession}
					<div class="account static">
						<div class="ava">
							{#if $siteProfile?.avatar_url}<img src={$siteProfile.avatar_url} alt="" referrerpolicy="no-referrer" />{:else}<Icon name="user" size={26} />{/if}
						</div>
						<div>
							<span class="login">{currentSiteName()}</span>
							<span class="sub">{$siteSession.user?.email}</span>
						</div>
					</div>
					<button class="logout" on:click={siteLogout}>Выйти из аккаунта AniShiki</button>
				{:else}
					<a class="login-cta" href="/register">Создать аккаунт AniShiki</a>
				{/if}
			</section>
		{/if}

		<section class="card">
			<h2>Внешний вид</h2>
			<div class="field">
				<span class="label">Тема</span>
				<div class="chips">
					{#each themeValues as t}
						<button class="chip" class:active={$guiSettings.theme === t.value} on:click={() => setTheme(t.value)}>{t.label}</button>
					{/each}
				</div>
			</div>
		</section>

		<section class="card">
			<h2>Воспроизведение</h2>
			<div class="field">
				<span class="label">Источник по умолчанию</span>
				<div class="chips">
					{#each sourceValues as s}
						<button class="chip" class:active={$playingSettings.defaultSource === s.value} on:click={() => setSource(s.value)}>{s.label}</button>
					{/each}
				</div>
			</div>
			<div class="field">
				<span class="label">Качество по умолчанию</span>
				<div class="chips">
					{#each qualityValues as q}
						<button class="chip" class:active={$playingSettings.defaultQuality === q.value} on:click={() => setQuality(q.value)}>{q.label}</button>
					{/each}
				</div>
			</div>
			<div class="field row">
				<div>
					<span class="label">Не сохранять историю просмотра</span>
					<span class="hint">Эпизоды не будут отмечаться как просмотренные</span>
				</div>
				<button class="toggle" class:on={$playingSettings.disableHistory} on:click={toggleHistory} aria-label="Переключить">
					<span class="knob"></span>
				</button>
			</div>
		</section>

		<section class="card">
			<h2>Сервер API</h2>
			<div class="field">
				<span class="label">Эндпоинт</span>
				<div class="chips">
					{#each endpointValues as e}
						<button class="chip" class:active={$endpointUrl === e.value} on:click={() => setEndpoint(e.value)}>{e.label}</button>
					{/each}
				</div>
				<span class="hint">При проблемах с загрузкой попробуйте сменить сервер.</span>
			</div>
		</section>

		<p class="about">
			AniShiki — неофициальный веб-клиент Anixart. Создано на основе открытых API.
			Не связано с Anixart. <span class="beta">β</span>
		</p>
	</div>
</div>

<style>
	.page {
		height: 100%;
		overflow-y: auto;
	}
	.inner {
		max-width: 720px;
		margin: 0 auto;
		padding: 24px;
	}
	h1 {
		font-size: 30px;
		font-weight: 800;
		margin-bottom: 22px;
	}
	.card {
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		border-radius: 18px;
		padding: 20px;
		margin-bottom: 18px;
	}
	.card h2 {
		font-size: 16px;
		font-weight: 700;
		margin-bottom: 16px;
	}
	.account {
		display: flex;
		align-items: center;
		gap: 14px;
		color: var(--text-color);
	}
	.ava {
		width: 54px;
		height: 54px;
		border-radius: 50%;
		overflow: hidden;
		display: grid;
		place-items: center;
		background: var(--background-color);
		color: var(--secondary-text-color);
	}
	.ava img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.account .login {
		display: block;
		font-weight: 700;
		font-size: 16px;
	}
	.account .sub {
		font-size: 13px;
		color: var(--secondary-text-color);
	}
	.account > div:nth-child(2) {
		flex: 1;
	}
	.logout {
		width: 100%;
		margin-top: 16px;
		padding: 12px;
		border: 1px solid var(--danger-color);
		background: transparent;
		color: var(--danger-color);
		border-radius: 12px;
		font-weight: 600;
		cursor: pointer;
	}
	.login-cta {
		display: block;
		text-align: center;
		padding: 14px;
		background: var(--primary-color);
		color: #fff;
		border-radius: 12px;
		font-weight: 700;
	}
	.field {
		margin-bottom: 18px;
	}
	.field:last-child {
		margin-bottom: 0;
	}
	.field.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}
	.label {
		display: block;
		font-size: 14px;
		font-weight: 600;
		margin-bottom: 10px;
	}
	.field.row .label {
		margin-bottom: 2px;
	}
	.hint {
		display: block;
		font-size: 12px;
		color: var(--third-text-color);
		margin-top: 8px;
	}
	.field.row .hint {
		margin-top: 0;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.chip {
		padding: 9px 16px;
		border: 1px solid var(--glass-border);
		background: var(--background-color);
		color: var(--text-color);
		border-radius: 11px;
		cursor: pointer;
		font-size: 13px;
		font-weight: 500;
	}
	.chip.active {
		background: var(--primary-color);
		color: #fff;
		border-color: transparent;
	}
	.toggle {
		width: 52px;
		height: 30px;
		min-width: 52px;
		border-radius: 16px;
		border: none;
		background: var(--gray-btn);
		position: relative;
		cursor: pointer;
		transition: background 0.2s ease;
	}
	.toggle.on {
		background: var(--primary-color);
	}
	.knob {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: #fff;
		transition: transform 0.2s ease;
	}
	.toggle.on .knob {
		transform: translateX(22px);
	}
	.about {
		text-align: center;
		font-size: 13px;
		color: var(--third-text-color);
		line-height: 1.6;
		margin-top: 24px;
	}
	.beta {
		color: var(--primary-color);
		font-weight: 700;
	}
	@media (max-width: 768px) {
		.inner {
			padding: 16px 12px;
		}
		h1 {
			font-size: 24px;
		}
	}
</style>
