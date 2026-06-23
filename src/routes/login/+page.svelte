<script>
	import { goto } from '$app/navigation';
	import { getApi, reinitApi, setApiToken } from '$lib/api';
	import { userToken, notificationCount, showToast } from '$lib/stores';
	import Icon from '$lib/components/Icon.svelte';

	let login = '';
	let password = '';
	let loading = false;
	let errorMsg = '';

	const errs = { 2: 'Неверный логин', 3: 'Неверный пароль' };

	async function submit() {
		if (!login.trim() || !password) {
			errorMsg = 'Заполните все поля';
			return;
		}
		loading = true;
		errorMsg = '';
		try {
			const res = await getApi().auth.signIn({ login: login.trim(), password });
			if (res?.code === 0 && res.profileToken) {
				const tok = {
					token: res.profileToken.token,
					id: res.profile.id,
					login: res.profile.login,
					avatar: res.profile.avatar,
					status: res.profile.status
				};
				userToken.set(tok);
				setApiToken(tok);
				reinitApi();
				getApi()
					.notification?.countNotifications()
					.then((r) => notificationCount.set(r?.count ?? 0))
					.catch(() => {});
				showToast('Добро пожаловать!', 'success');
				goto('/');
			} else {
				errorMsg = errs[res?.code] || 'Не удалось войти';
			}
		} catch (e) {
			console.error(e);
			errorMsg = 'Ошибка соединения';
		}
		loading = false;
	}
</script>

<svelte:head><title>Вход — AniShiki</title></svelte:head>

<div class="auth">
	<div class="card glass">
		<a href="/" class="logo"><img src="/favicon.svg" alt="AniShiki" /></a>
		<h1>С возвращением</h1>
		<p class="sub">Войдите в аккаунт Anixart</p>

		<form on:submit|preventDefault={submit}>
			<label>
				<span>Логин или email</span>
				<input type="text" bind:value={login} autocomplete="username" placeholder="ваш логин" />
			</label>
			<label>
				<span>Пароль</span>
				<input type="password" bind:value={password} autocomplete="current-password" placeholder="••••••••" />
			</label>

			{#if errorMsg}<div class="err">{errorMsg}</div>{/if}

			<button class="submit" type="submit" disabled={loading}>
				{loading ? 'Вход…' : 'Войти'}
			</button>
		</form>

		<p class="foot">
			Нет аккаунта? <a href="/register">Зарегистрироваться</a>
		</p>
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
		max-width: 420px;
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
		margin: 8px 0 28px;
	}
	form {
		display: flex;
		flex-direction: column;
		gap: 16px;
		text-align: left;
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
	.submit {
		padding: 14px;
		border: none;
		border-radius: 12px;
		background: var(--primary-color);
		color: #fff;
		font-weight: 700;
		font-size: 15px;
		cursor: pointer;
		box-shadow: 0 8px 24px var(--primary-glow);
	}
	.submit:disabled {
		opacity: 0.6;
	}
	.foot {
		margin-top: 22px;
		font-size: 14px;
		color: var(--secondary-text-color);
	}
	.foot a {
		color: var(--primary-color);
		font-weight: 600;
	}
	.skip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-top: 14px;
		font-size: 13px;
		color: var(--third-text-color);
	}
</style>
