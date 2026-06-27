<script>
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';
	import { supabaseEnabled } from '$lib/supabase';
	import { siteSignUp } from '$lib/stores/auth';
	import { showToast } from '$lib/stores';

	let username = '';
	let email = '';
	let password = '';
	let loading = false;
	let errorMsg = '';
	let done = false;

	async function submit() {
		if (!username.trim() || !email.trim() || !password) {
			errorMsg = 'Заполните все поля';
			return;
		}
		if (password.length < 6) {
			errorMsg = 'Пароль не короче 6 символов';
			return;
		}
		loading = true;
		errorMsg = '';
		try {
			const data = await siteSignUp(email.trim(), password, username.trim());
			if (data.session) {
				showToast('Аккаунт создан, добро пожаловать!', 'success');
				goto('/');
			} else {
				// включено подтверждение email
				done = true;
			}
		} catch (e) {
			const m = e?.message || '';
			errorMsg = /already registered/i.test(m)
				? 'Этот email уже зарегистрирован'
				: m || 'Не удалось зарегистрироваться';
		}
		loading = false;
	}
</script>

<svelte:head><title>Регистрация — AniShiki</title></svelte:head>

<div class="auth">
	<div class="card glass">
		<a href="/" class="logo"><img src="/favicon.svg" alt="AniShiki" /></a>

		{#if supabaseEnabled}
			<h1>Регистрация</h1>
			<p class="sub">Создайте аккаунт AniShiki — без привязки к Anixart</p>

			{#if done}
				<div class="note">
					<Icon name="discover" size={20} />
					<p>Мы отправили письмо для подтверждения на <b>{email}</b>. Перейдите по ссылке из письма и войдите.</p>
				</div>
				<a class="submit" href="/login">Перейти ко входу</a>
			{:else}
				<form on:submit|preventDefault={submit}>
					<label>
						<span>Имя пользователя</span>
						<input type="text" bind:value={username} autocomplete="username" placeholder="ник" />
					</label>
					<label>
						<span>Email</span>
						<input type="email" bind:value={email} autocomplete="email" placeholder="you@example.com" />
					</label>
					<label>
						<span>Пароль</span>
						<input type="password" bind:value={password} autocomplete="new-password" placeholder="не короче 6 символов" />
					</label>

					{#if errorMsg}<div class="err">{errorMsg}</div>{/if}

					<button class="submit btn" type="submit" disabled={loading}>
						{loading ? 'Создаём…' : 'Создать аккаунт'}
					</button>
				</form>

				<p class="hint">
					Аккаунт AniShiki даёт профиль и совместный просмотр. Для закладок/истории Anixart нужен
					аккаунт Anixart — <a href="/login">войти в него</a>.
				</p>
			{/if}
		{:else}
			<h1>Регистрация</h1>
			<p class="sub">Создать новый аккаунт можно в официальном приложении Anixart</p>

			<div class="note">
				<Icon name="discover" size={20} />
				<p>
					Регистрация через неофициальный API недоступна — сервер Anixart не выдаёт код подтверждения
					сторонним клиентам. Зарегистрируйтесь в официальном приложении, затем войдите здесь теми же
					данными — все функции (закладки, история, оценки, друзья) будут доступны.
				</p>
			</div>

			<div class="links">
				<a class="ext" href="https://play.google.com/store/apps/details?id=com.swiftsoft.anixartd" target="_blank" rel="noopener">
					Google Play <Icon name="chevronRight" size={16} />
				</a>
				<a class="ext" href="https://anixart.tv" target="_blank" rel="noopener">
					anixart.tv <Icon name="chevronRight" size={16} />
				</a>
			</div>
		{/if}

		<a class="alt" href="/login">У меня уже есть аккаунт — войти</a>
		<a class="skip" href="/">Продолжить без входа <Icon name="chevronRight" size={16} /></a>
	</div>
</div>

<style>
	.auth {
		min-height: 100vh;
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 24px;
		background:
			radial-gradient(ellipse at top, color-mix(in srgb, var(--primary-color) 18%, transparent), transparent 60%),
			var(--background-color);
	}
	.card {
		width: 100%;
		max-width: 440px;
		padding: 40px 32px;
		border-radius: 24px;
		text-align: center;
		animation: fadeInUp 0.4s ease;
	}
	.logo {
		width: 60px;
		height: 60px;
		border-radius: 18px;
		overflow: hidden;
		display: grid;
		place-items: center;
		margin: 0 auto 20px;
		box-shadow: 0 8px 24px var(--primary-glow);
	}
	.logo img {
		width: 100%;
		height: 100%;
	}
	h1 {
		font-size: 26px;
		font-weight: 800;
	}
	.sub {
		color: var(--secondary-text-color);
		margin: 8px 0 24px;
	}
	.note {
		display: flex;
		gap: 12px;
		text-align: left;
		padding: 16px;
		border-radius: 14px;
		background: var(--background-color);
		border: 1px solid var(--glass-border);
		margin-bottom: 20px;
	}
	.note :global(svg) {
		flex-shrink: 0;
		color: var(--info-color);
		margin-top: 2px;
	}
	.note p {
		font-size: 13px;
		line-height: 1.55;
		color: var(--secondary-text-color);
	}
	.links {
		display: flex;
		gap: 10px;
		margin-bottom: 20px;
	}
	.ext {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 12px;
		border-radius: 12px;
		border: 1px solid var(--glass-border);
		background: var(--elevated-color);
		color: var(--text-color);
		font-weight: 600;
		font-size: 14px;
	}
	.ext:hover {
		border-color: var(--primary-color);
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 16px;
		text-align: left;
		margin-bottom: 8px;
	}
	label span {
		display: block;
		font-size: 13px;
		font-weight: 600;
		color: var(--secondary-text-color);
		margin-bottom: 6px;
	}
	input {
		width: 100%;
		padding: 13px 16px;
		border-radius: 12px;
		border: 1px solid var(--glass-border);
		background: var(--background-color);
		color: var(--text-color);
		font-size: 15px;
		outline: none;
		transition: border-color 0.2s ease;
	}
	input:focus {
		border-color: var(--primary-color);
	}
	.err {
		color: #fff;
		background: var(--danger-color);
		padding: 10px 14px;
		border-radius: 10px;
		font-size: 13px;
	}
	.btn {
		width: 100%;
		border: none;
		cursor: pointer;
	}
	.btn:disabled {
		opacity: 0.6;
	}
	.hint {
		margin-top: 16px;
		font-size: 13px;
		line-height: 1.5;
		color: var(--secondary-text-color);
	}
	.hint a {
		color: var(--primary-color);
		font-weight: 600;
	}
	.submit {
		display: block;
		padding: 14px;
		border-radius: 12px;
		background: var(--primary-color);
		color: #fff;
		font-weight: 700;
		font-size: 15px;
		box-shadow: 0 8px 24px var(--primary-glow);
	}
	.alt {
		display: block;
		margin-top: 16px;
		font-size: 14px;
		color: var(--primary-color);
		font-weight: 600;
	}
	.skip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-top: 16px;
		font-size: 13px;
		color: var(--third-text-color);
	}
</style>
