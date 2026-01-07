<script>
    import { goto } from '$app/navigation';
    import { guiSettings, userToken, endpointUrl } from '$lib/stores';
    import { reinitializeApi } from '$lib/api';
    import { themeValues, endpointValues } from '$lib/utils';

    $: settings = $guiSettings;
    $: utoken = $userToken;
    $: endpoint = $endpointUrl;

    function updateTheme(value) {
        guiSettings.update(s => ({ ...s, theme: value }));
    }

    function updateEndpoint(value) {
        endpointUrl.set(value);
        reinitializeApi();
    }

    function logout() {
        if (confirm('Вы уверены, что хотите выйти?')) {
            userToken.set(null);
            reinitializeApi();
            goto('/');
        }
    }

    const version = '0.0.1b';
</script>

<svelte:head>
    <title>Настройки - AniShika Web</title>
</svelte:head>

<div class="settings-page">
    <h1 class="page-title">Настройки</h1>

    <!-- Account section -->
    {#if utoken}
        <section class="settings-section">
            <h2>Аккаунт</h2>
            <div class="account-info">
                <div class="account-avatar">
                    {#if utoken.avatar}
                        <img src={utoken.avatar} alt="Avatar" />
                    {:else}
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                    {/if}
                </div>
                <div class="account-details">
                    <span class="account-name">{utoken.login || 'Пользователь'}</span>
                    <span class="account-id">ID: {utoken.id}</span>
                </div>
                <button class="logout-btn" on:click={logout}>
                    Выйти
                </button>
            </div>
        </section>
    {:else}
        <section class="settings-section">
            <h2>Аккаунт</h2>
            <div class="not-logged-in">
                <p>Вы не авторизованы</p>
                <a href="/login" class="login-link">Войти в аккаунт</a>
            </div>
        </section>
    {/if}

    <!-- Appearance section -->
    <section class="settings-section">
        <h2>Внешний вид</h2>
        
        <div class="setting-item">
            <div class="setting-info">
                <span class="setting-label">Тема</span>
                <span class="setting-description">Выберите цветовую схему</span>
            </div>
            <select 
                class="setting-select"
                value={settings.theme}
                on:change={(e) => updateTheme((/** @type {HTMLSelectElement} */ (e.target)).value)}
            >
                {#each themeValues as option}
                    <option value={option.value}>{option.label}</option>
                {/each}
            </select>
        </div>
    </section>

    <!-- API section -->
    <section class="settings-section">
        <h2>API</h2>
        
        <div class="setting-item">
            <div class="setting-info">
                <span class="setting-label">Сервер API</span>
                <span class="setting-description">Выберите сервер для подключения</span>
            </div>
            <select 
                class="setting-select"
                value={endpoint}
                on:change={(e) => updateEndpoint((/** @type {HTMLSelectElement} */ (e.target)).value)}
            >
                {#each endpointValues as option}
                    <option value={option.value}>{option.label}</option>
                {/each}
            </select>
        </div>
    </section>

    <!-- About section -->
    <section class="settings-section">
        <h2>О приложении</h2>
        
        <div class="about-info">
            <div class="about-item">
                <span class="about-label">Версия</span>
                <span class="about-value">{version}</span>
            </div>
            <div class="about-item">
                <span class="about-label">Разработчики</span>
                <span class="about-value">Bourbon24k</span>
            </div>
        </div>

        <p class="disclaimer">
            AniShika — неофициальный клиент Anixart. Все права на контент принадлежат их правообладателям.
        </p>
    </section>
</div>

<style>
    .settings-page {
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
    }

    .page-title {
        font-size: 28px;
        margin: 0 0 30px;
        color: var(--text-color);
    }

    .settings-section {
        background-color: var(--alt-background-color);
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 20px;
    }

    .settings-section h2 {
        font-size: 18px;
        margin: 0 0 16px;
        color: var(--text-color);
        padding-bottom: 12px;
        border-bottom: 1px solid var(--background-color);
    }

    .setting-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 0;
        gap: 16px;
    }

    .setting-item:not(:last-child) {
        border-bottom: 1px solid var(--background-color);
    }

    .setting-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .setting-label {
        font-size: 15px;
        font-weight: 500;
        color: var(--text-color);
    }

    .setting-description {
        font-size: 13px;
        color: var(--secondary-text-color);
    }

    .setting-select {
        padding: 10px 14px;
        font-size: 14px;
        border: none;
        border-radius: 8px;
        background-color: var(--background-color);
        color: var(--text-color);
        cursor: pointer;
        min-width: 180px;
    }

    .account-info {
        display: flex;
        align-items: center;
        gap: 16px;
    }

    .account-avatar {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        overflow: hidden;
        background-color: var(--background-color);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .account-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .account-avatar svg {
        width: 32px;
        height: 32px;
        color: var(--secondary-text-color);
    }

    .account-details {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1;
    }

    .account-name {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-color);
    }

    .account-id {
        font-size: 13px;
        color: var(--secondary-text-color);
    }

    .logout-btn {
        padding: 10px 20px;
        font-size: 14px;
        font-weight: 500;
        border: none;
        border-radius: 8px;
        background-color: var(--dropped-color);
        color: white;
        cursor: pointer;
        transition: filter 0.2s;
    }

    .logout-btn:hover {
        filter: brightness(1.1);
    }

    .not-logged-in {
        text-align: center;
        padding: 20px;
    }

    .not-logged-in p {
        margin: 0 0 16px;
        color: var(--secondary-text-color);
    }

    .login-link {
        display: inline-block;
        padding: 12px 24px;
        background-color: var(--primary-color);
        color: white;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 500;
    }

    .about-info {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 20px;
    }

    .about-item {
        display: flex;
        justify-content: space-between;
    }

    .about-label {
        color: var(--secondary-text-color);
        font-size: 14px;
    }

    .about-value {
        color: var(--text-color);
        font-size: 14px;
        font-weight: 500;
    }

    .disclaimer {
        font-size: 12px;
        color: var(--secondary-text-color);
        text-align: center;
        margin: 0;
        opacity: 0.7;
    }

    @media (max-width: 768px) {
        .settings-page {
            padding: 16px;
        }

        .page-title {
            font-size: 24px;
        }

        .setting-item {
            flex-direction: column;
            align-items: flex-start;
        }

        .setting-select {
            width: 100%;
        }

        .account-info {
            flex-wrap: wrap;
        }

        .logout-btn {
            width: 100%;
            margin-top: 12px;
        }
    }
</style>
