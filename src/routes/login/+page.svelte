<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { userToken } from '$lib/stores';
    import { reinitializeApi } from '$lib/api';
    import { Anixart } from 'anixartjs';

    let login = '';
    let password = '';
    let isLoading = false;
    let error = '';
    let showPassword = false;

    onMount(() => {
        if (browser && $userToken) {
            goto('/');
        }
    });

    async function handleLogin(e) {
        e.preventDefault();
        
        if (!login || !password) {
            error = 'Заполните все поля';
            return;
        }

        isLoading = true;
        error = '';

        try {
            const anixart = new Anixart({
                baseUrl: 'https://api-s.anixsekai.com'
            });
            
            const response = await anixart.endpoints.auth.signIn({
                login: login,
                password: password
            });
            
            // Check response code (0 = success)
            if (response.code === 0 && response.profileToken) {
                const userData = {
                    token: response.profileToken.token,
                    id: response.profile?.id,
                    login: response.profile?.login,
                    avatar: response.profile?.avatar
                };
                
                userToken.set(userData);
                reinitializeApi();
                goto('/');
            } else {
                // Handle specific error codes
                switch(response.code) {
                    case 2:
                        error = 'Неверный логин!';
                        break;
                    case 3:
                        error = 'Неверный пароль!';
                        break;
                    default:
                        error = 'Ошибка авторизации';
                }
            }
        } catch (e) {
            console.error('Login error:', e);
            error = 'Ошибка подключения к серверу';
        }

        isLoading = false;
    }

    function togglePassword() {
        showPassword = !showPassword;
    }
</script>

<svelte:head>
    <title>Вход - AniShika Web</title>
</svelte:head>

<div class="login-page">
    <div class="login-container">
        <div class="login-header">
            <h1>AniShika <sup>β</sup></h1>
            <p>Войдите в свой аккаунт Anixart</p>
        </div>

        <form class="login-form" on:submit={handleLogin}>
            {#if error}
                <div class="error-message">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    {error}
                </div>
            {/if}

            <div class="input-group">
                <label for="login">Логин или email</label>
                <input
                    type="text"
                    id="login"
                    bind:value={login}
                    placeholder="Введите логин"
                    disabled={isLoading}
                />
            </div>

            <div class="input-group">
                <label for="password">Пароль</label>
                <div class="password-wrapper">
                    <input
                        type={showPassword ? 'text' : 'password'}
                        id="password"
                        bind:value={password}
                        placeholder="Введите пароль"
                        disabled={isLoading}
                    />
                    <button 
                        type="button" 
                        class="toggle-password"
                        on:click={togglePassword}
                        aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                        {#if showPassword}
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                            </svg>
                        {:else}
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                            </svg>
                        {/if}
                    </button>
                </div>
            </div>

            <button type="submit" class="login-btn" disabled={isLoading}>
                {#if isLoading}
                    <span class="spinner"></span>
                    Вход...
                {:else}
                    Войти
                {/if}
            </button>
        </form>

        <div class="login-footer">
            <p>Нет аккаунта? <a href="/register">Зарегистрируйтесь</a></p>
            <p class="disclaimer">
                AniShika — неофициальный клиент. Мы не храним ваши данные.
            </p>
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
        padding: 40px;
        background-color: var(--alt-background-color);
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    }

    .login-header {
        text-align: center;
        margin-bottom: 30px;
    }

    .login-header h1 {
        font-size: 32px;
        margin: 0 0 8px;
        color: var(--text-color);
    }

    .login-header h1 sup {
        font-size: 14px;
        color: var(--primary-color);
    }

    .login-header p {
        margin: 0;
        color: var(--secondary-text-color);
        font-size: 14px;
    }

    .login-form {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .error-message {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        background-color: rgba(255, 107, 107, 0.1);
        border: 1px solid var(--primary-color);
        border-radius: 8px;
        color: var(--primary-color);
        font-size: 14px;
    }

    .error-message svg {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
    }

    .input-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .input-group label {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-color);
    }

    .input-group input {
        padding: 14px 16px;
        font-size: 15px;
        border: 2px solid transparent;
        border-radius: 10px;
        background-color: var(--background-color);
        color: var(--text-color);
        outline: none;
        transition: border-color 0.2s;
    }

    .input-group input:focus {
        border-color: var(--primary-color);
    }

    .input-group input::placeholder {
        color: var(--secondary-text-color);
    }

    .input-group input:disabled {
        opacity: 0.6;
    }

    .password-wrapper {
        position: relative;
    }

    .password-wrapper input {
        width: 100%;
        padding-right: 50px;
    }

    .toggle-password {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--secondary-text-color);
        cursor: pointer;
        transition: color 0.2s;
    }

    .toggle-password:hover {
        color: var(--text-color);
    }

    .toggle-password svg {
        width: 20px;
        height: 20px;
    }

    .login-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 14px;
        font-size: 16px;
        font-weight: 600;
        border: none;
        border-radius: 10px;
        background-color: var(--primary-color);
        color: white;
        cursor: pointer;
        transition: filter 0.2s;
    }

    .login-btn:hover:not(:disabled) {
        filter: brightness(1.1);
    }

    .login-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }

    .spinner {
        width: 18px;
        height: 18px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .login-footer {
        margin-top: 30px;
        text-align: center;
    }

    .login-footer p {
        margin: 0 0 10px;
        font-size: 14px;
        color: var(--secondary-text-color);
    }

    .login-footer a {
        color: var(--primary-color);
        text-decoration: none;
    }

    .login-footer a:hover {
        text-decoration: underline;
    }

    .disclaimer {
        font-size: 12px !important;
        opacity: 0.7;
    }

    @media (max-width: 768px) {
        .login-container {
            padding: 30px 24px;
        }

        .login-header h1 {
            font-size: 28px;
        }
    }
</style>
