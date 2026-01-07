<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { Anixart } from 'anixartjs';

	let email = '';
	let password = '';
	let loading = false;
	let error = '';
	let isMobile = false;

	if (browser) {
		isMobile = window.innerWidth <= 768;
	}

	async function handleLogin() {
		if (!email || !password) {
			error = 'Заполните все поля';
			return;
		}

		loading = true;
		error = '';

		try {
			const endpointUrl = localStorage.getItem('endpointUrl') || 'api-s.anixsekai.com';
			const anixApi = new Anixart({
				baseUrl: `https://${endpointUrl}`
			}).endpoints;

			const result = await anixApi.auth.login(email, password);
			
			if (result && result.token) {
				localStorage.setItem('user_token', JSON.stringify(result));
				window.location.reload();
			} else {
				error = 'Ошибка авторизации';
			}
		} catch (err) {
			console.error('Login error:', err);
			error = 'Неверный логин или пароль';
		} finally {
			loading = false;
		}
	}

	function handleKeyPress(event) {
		if (event.key === 'Enter') {
			handleLogin();
		}
	}
</script>

<div class="login-page" class:mobile={isMobile}>
	<div class="login-container">
		<div class="login-header">
			<h1>Вход в AniShika</h1>
			<p>Войдите с помощью вашего аккаунта Anixart</p>
		</div>

		<form class="login-form" on:submit|preventDefault={handleLogin}>
			<div class="form-group">
				<label for="email">Email или логин</label>
				<input
					id="email"
					type="text"
					bind:value={email}
					on:keypress={handleKeyPress}
					placeholder="Введите email или логин"
					disabled={loading}
				/>
			</div>

			<div class="form-group">
				<label for="password">Пароль</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					on:keypress={handleKeyPress}
					placeholder="Введите пароль"
					disabled={loading}
				/>
			</div>

			{#if error}
				<div class="error-message">{error}</div>
			{/if}

			<button type="submit" class="login-btn" disabled={loading}>
				{#if loading}
					<span class="spinner-small"></span>
					Вход...
				{:else}
					Войти
				{/if}
			</button>
		</form>

		<div class="login-footer">
			<p>Нет аккаунта? Зарегистрируйтесь на <a href="https://anixart.tv" target="_blank" rel="noopener">Anixart</a></p>
		</div>
	</div>
</div>

<style>
	.login-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100%;
		padding: 20px;
	}

	.login-container {
		width: 100%;
		max-width: 400px;
		background: var(--alt-background-color);
		border-radius: 16px;
		padding: 40px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
	}

	.mobile .login-container {
		padding: 24px;
	}

	.login-header {
		text-align: center;
		margin-bottom: 32px;
	}

	.login-header h1 {
		font-size: 24px;
		font-weight: 600;
		color: var(--text-color);
		margin-bottom: 8px;
	}

	.login-header p {
		font-size: 14px;
		color: rgba(255, 255, 255, 0.6);
	}

	.login-form {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.form-group label {
		font-size: 14px;
		font-weight: 500;
		color: var(--text-color);
	}

	.form-group input {
		padding: 12px 16px;
		background: var(--background-color);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
		color: var(--text-color);
		font-size: 14px;
		transition: border-color 0.2s;
	}

	.form-group input:focus {
		outline: none;
		border-color: var(--primary-color);
	}

	.form-group input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.error-message {
		padding: 12px;
		background: rgba(255, 107, 107, 0.1);
		border: 1px solid var(--primary-color);
		border-radius: 8px;
		color: var(--primary-color);
		font-size: 14px;
		text-align: center;
	}

	.login-btn {
		padding: 14px;
		background: var(--primary-color);
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.login-btn:hover:not(:disabled) {
		opacity: 0.9;
	}

	.login-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.spinner-small {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.login-footer {
		margin-top: 24px;
		text-align: center;
		font-size: 14px;
		color: rgba(255, 255, 255, 0.6);
	}

	.login-footer a {
		color: var(--primary-color);
		text-decoration: none;
	}

	.login-footer a:hover {
		text-decoration: underline;
	}
</style>
