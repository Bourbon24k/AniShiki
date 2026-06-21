<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { get } from 'svelte/store';
    import { userToken, endpointUrl } from '$lib/stores';
    import { reinitializeApi } from '$lib/api';
    import { Anixart } from 'anixartjs';

    let login = '';
    let password = '';
    let isLoading = false;
    let error = '';
    let showPassword = false;

    onMount(() => {
        if (browser && $userToken) goto('/');
    });

    async function handleLogin(e) {
        e.preventDefault();
        if (!login || !password) { error = 'Заполните все поля'; return; }

        isLoading = true;
        error = '';
        try {
            const endpoint = get(endpointUrl);
            const anixart = new Anixart({ baseUrl: `https://${endpoint}` });
            const response = await anixart.endpoints.auth.signIn({ login, password });

            if (response.code === 0 && response.profileToken) {
                userToken.set({
                    token: response.profileToken.token,
                    id: response.profile?.id,
                    login: response.profile?.login,
                    avatar: response.profile?.avatar
                });
                reinitializeApi();
                goto('/');
            } else {
                switch (response.code) {
                    case 2: error = 'Неверный логин!'; break;
                    case 3: error = 'Неверный пароль!'; break;
                    default: error = 'Ошибка авторизации';
                }
            }
        } catch (e) {
            console.error('Login error:', e);
            error = 'Ошибка подключения к серверу';
        }
        isLoading = false;
    }
</script>

<svelte:head>
    <title>Вход — AniShiki</title>
</svelte:head>

<div class="auth-page">
    <div class="auth-card fade-in">
        <a href="/" class="brand"><span class="brand-mark">A</span><span>AniShiki</span></a>
        <h1 class="auth-title">С возвращением</h1>
        <p class="auth-sub">Войдите в свой аккаунт Anixart, чтобы синхронизировать закладки, историю и друзей.</p>

        <form on:submit={handleLogin} class="auth-form">
            <label class="field">
                <span>Логин или e-mail</span>
                <input type="text" bind:value={login} placeholder="Ваш логин" autocomplete="username" />
            </label>
            <label class="field">
                <span>Пароль</span>
                <div class="pass-wrap">
                    {#if showPassword}
                        <input type="text" bind:value={password} placeholder="Пароль" autocomplete="current-password" />
                    {:else}
                        <input type="password" bind:value={password} placeholder="Пароль" autocomplete="current-password" />
                    {/if}
                    <button type="button" class="pass-toggle" on:click={() => showPassword = !showPassword} aria-label="Показать пароль">
                        {showPassword ? '🙈' : '👁'}
                    </button>
                </div>
            </label>

            {#if error}<div class="msg error">{error}</div>{/if}

            <button type="submit" class="btn btn-primary submit" disabled={isLoading}>
                {isLoading ? 'Вход…' : 'Войти'}
            </button>
        </form>

        <div class="auth-foot">
            Нет аккаунта? <a href="/register">Зарегистрироваться</a>
        </div>
    </div>
</div>

<style>
    .auth-page {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100%;
        padding: 24px;
        background:
            radial-gradient(60% 50% at 80% 0%, var(--accent-soft), transparent 70%),
            radial-gradient(50% 50% at 0% 100%, rgba(99,102,241,0.10), transparent 70%);
    }

    .auth-card {
        width: 100%;
        max-width: 440px;
        padding: 36px 32px;
        background: var(--surface-2);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
    }

    .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; font-weight: 800; font-size: 20px; color: var(--text-color); margin-bottom: 22px; }
    .brand-mark { width: 34px; height: 34px; border-radius: 10px; background: var(--accent-gradient); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 900; }

    .auth-title { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 6px; }
    .auth-sub { color: var(--secondary-text-color); font-size: 14px; line-height: 1.5; margin: 0 0 22px; }

    .auth-form { display: flex; flex-direction: column; gap: 14px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field span { font-size: 13px; font-weight: 600; color: var(--secondary-text-color); }
    .field input {
        width: 100%;
        padding: 13px 15px;
        font-size: 15px;
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
        background: var(--surface-3);
        color: var(--text-color);
        outline: none;
        transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
    }
    .field input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }

    .pass-wrap { position: relative; }
    .pass-toggle {
        position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
        background: transparent; border: none; cursor: pointer; font-size: 16px; padding: 6px;
    }

    .submit { width: 100%; padding: 14px; font-size: 15px; margin-top: 4px; }

    .msg { font-size: 13px; padding: 10px 12px; border-radius: var(--radius-sm); }
    .msg.error { background: rgba(221,27,27,0.12); color: #ff6b6b; }

    .auth-foot { margin-top: 22px; text-align: center; font-size: 14px; color: var(--secondary-text-color); }
    .auth-foot a { color: var(--accent-strong); font-weight: 700; text-decoration: none; }
</style>
