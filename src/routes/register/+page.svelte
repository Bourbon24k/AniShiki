<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { userToken, endpointUrl } from '$lib/stores';
    import { reinitializeApi } from '$lib/api';
    import { get } from 'svelte/store';
    import { Anixart } from 'anixartjs';

    let step = 1; // 1 = data, 2 = email code
    let username = '';
    let email = '';
    let password = '';
    let password2 = '';
    let code = '';
    let hash = '';
    let expiresAt = 0;
    let countdown = 0;
    let timer;

    let isLoading = false;
    let error = '';
    let info = '';

    onMount(() => {
        if (browser && $userToken) goto('/');
        return () => timer && clearInterval(timer);
    });

    function makeClient() {
        const endpoint = get(endpointUrl);
        return new Anixart({ baseUrl: `https://${endpoint}` });
    }

    function startCountdown() {
        clearInterval(timer);
        timer = setInterval(() => {
            countdown = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
            if (countdown <= 0) clearInterval(timer);
        }, 1000);
    }

    const registerErrors = {
        2: 'Некорректный логин',
        3: 'Некорректный e-mail',
        4: 'Слабый пароль (минимум 8 символов)',
        5: 'Этот логин уже занят',
        6: 'Этот e-mail уже используется',
        7: 'Код уже отправлен, проверьте почту',
        8: 'Не удалось отправить код',
        9: 'Регистрация через e-mail недоступна',
        10: 'Слишком много регистраций, попробуйте позже',
        11: 'Неверный код подтверждения'
    };

    async function submitData(e) {
        e.preventDefault();
        error = ''; info = '';
        if (!username || !email || !password) { error = 'Заполните все поля'; return; }
        if (password.length < 8) { error = 'Пароль должен быть не короче 8 символов'; return; }
        if (password !== password2) { error = 'Пароли не совпадают'; return; }

        isLoading = true;
        try {
            const api = makeClient().endpoints;
            const res = await api.auth.signUp({ username, password, email });
            if (res.code === 0) {
                hash = res.hash;
                expiresAt = (res.codeTimestampExpires ? res.codeTimestampExpires * 1000 : Date.now() + 15 * 60000);
                startCountdown();
                step = 2;
                info = `Код подтверждения отправлен на ${email}`;
            } else {
                error = registerErrors[res.code] || `Не удалось зарегистрироваться (код ${res.code})`;
            }
        } catch (err) {
            console.error('signUp error:', err);
            const msg = String(err?.message || err);
            if (msg.includes('Bad Request') || msg.includes('JSON')) {
                error = 'Этот API-сервер не поддерживает регистрацию. Смените сервер в Настройках или зарегистрируйтесь в приложении Anixart.';
            } else {
                error = 'Ошибка подключения к серверу. Проверьте сеть или смените API-сервер в настройках.';
            }
        }
        isLoading = false;
    }

    async function submitCode(e) {
        e.preventDefault();
        error = ''; info = '';
        if (!code) { error = 'Введите код из письма'; return; }

        isLoading = true;
        try {
            const api = makeClient().endpoints;
            const res = await api.auth.signUpVerify({ username, password, email, code: Number(code), hash });
            if (res.code === 0 && res.profileToken) {
                userToken.set({
                    token: res.profileToken.token,
                    id: res.profile?.id,
                    login: res.profile?.login,
                    avatar: res.profile?.avatar
                });
                reinitializeApi();
                goto('/');
            } else {
                error = registerErrors[res.code] || 'Неверный или просроченный код';
            }
        } catch (err) {
            console.error('signUpVerify error:', err);
            error = 'Ошибка подключения к серверу';
        }
        isLoading = false;
    }
</script>

<svelte:head>
    <title>Регистрация — AniShiki</title>
</svelte:head>

<div class="auth-page">
    <div class="auth-card fade-in">
        <a href="/" class="brand"><span class="brand-mark">A</span><span>AniShiki</span></a>

        {#if step === 1}
            <h1 class="auth-title">Создать аккаунт</h1>
            <p class="auth-sub">Регистрация напрямую через Anixart. На e-mail придёт код подтверждения.</p>

            <form on:submit={submitData} class="auth-form">
                <label class="field">
                    <span>Логин</span>
                    <input type="text" bind:value={username} placeholder="Ваш логин" autocomplete="username" />
                </label>
                <label class="field">
                    <span>E-mail</span>
                    <input type="email" bind:value={email} placeholder="you@example.com" autocomplete="email" />
                </label>
                <label class="field">
                    <span>Пароль</span>
                    <input type="password" bind:value={password} placeholder="Минимум 8 символов" autocomplete="new-password" />
                </label>
                <label class="field">
                    <span>Повторите пароль</span>
                    <input type="password" bind:value={password2} placeholder="Ещё раз" autocomplete="new-password" />
                </label>

                {#if error}<div class="msg error">{error}</div>{/if}

                <button type="submit" class="btn btn-primary submit" disabled={isLoading}>
                    {isLoading ? 'Отправка…' : 'Получить код'}
                </button>
            </form>
        {:else}
            <h1 class="auth-title">Подтверждение e-mail</h1>
            <p class="auth-sub">{info || `Введите код, отправленный на ${email}`}</p>

            <form on:submit={submitCode} class="auth-form">
                <label class="field">
                    <span>Код из письма</span>
                    <input type="text" inputmode="numeric" bind:value={code} placeholder="000000" />
                </label>

                {#if countdown > 0}
                    <div class="msg muted">Код действует ещё {countdown} сек.</div>
                {/if}
                {#if error}<div class="msg error">{error}</div>{/if}

                <button type="submit" class="btn btn-primary submit" disabled={isLoading}>
                    {isLoading ? 'Проверка…' : 'Завершить регистрацию'}
                </button>
                <button type="button" class="btn back" on:click={() => { step = 1; error=''; }}>Назад</button>
            </form>
        {/if}

        <div class="auth-foot">
            Уже есть аккаунт? <a href="/login">Войти</a>
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

    .submit { width: 100%; padding: 14px; font-size: 15px; margin-top: 4px; }
    .back { width: 100%; }

    .msg { font-size: 13px; padding: 10px 12px; border-radius: var(--radius-sm); }
    .msg.error { background: rgba(221,27,27,0.12); color: #ff6b6b; }
    .msg.muted { background: var(--surface-3); color: var(--secondary-text-color); }

    .auth-foot { margin-top: 22px; text-align: center; font-size: 14px; color: var(--secondary-text-color); }
    .auth-foot a { color: var(--accent-strong); font-weight: 700; text-decoration: none; }
</style>
