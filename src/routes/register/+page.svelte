<script>
    import { goto } from '$app/navigation';

    function goBack() {
        goto('/login');
    }

    function openRegister() {
        window.open('https://anixart.tv', '_blank', 'noopener');
    }
</script>

<svelte:head>
    <title>Регистрация - AniShika Web</title>
</svelte:head>

<div class="register-page">
    <div class="register-container">
        <div class="register-header">
            <h1>Регистрация</h1>
            <p>Аккаунт создаётся в официальном клиенте Anixart. Затем возвращайтесь и входите здесь.</p>
        </div>

        <div class="register-actions">
            <button class="primary" on:click={openRegister}>
                Официальный сайт Anixart
            </button>
            <button class="secondary" on:click={goBack}>
                Вернуться к входу
            </button>
        </div>

        <div class="register-note">
            <p>
                Мы не храним ваши данные. Авторизация выполняется напрямую через API Anixart.
            </p>
        </div>
    </div>
</div>

<style>
    .register-page {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100%;
        padding: 20px;
    }

    .register-container {
        width: 100%;
        max-width: 520px;
        padding: 36px;
        background-color: var(--alt-background-color);
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    }

    .register-header {
        text-align: center;
        margin-bottom: 24px;
    }

    .register-header h1 {
        font-size: 28px;
        margin: 0 0 10px;
        color: var(--text-color);
    }

    .register-header p {
        margin: 0;
        color: var(--secondary-text-color);
        font-size: 14px;
        line-height: 1.5;
    }

    .register-actions {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 18px;
    }

    button {
        border: none;
        border-radius: 12px;
        padding: 14px 16px;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
        transition: filter 0.2s, transform 0.05s;
    }

    button:active {
        transform: scale(0.99);
    }

    .primary {
        background: var(--primary-color);
        color: white;
    }

    .primary:hover {
        filter: brightness(1.06);
    }

    .secondary {
        background: var(--background-color);
        color: var(--text-color);
    }

    .secondary:hover {
        filter: brightness(1.06);
    }

    .register-note {
        padding-top: 12px;
        border-top: 1px solid var(--background-color);
        color: var(--secondary-text-color);
        font-size: 12px;
        text-align: center;
        line-height: 1.4;
    }

    .register-note p {
        margin: 0;
    }

    @media (max-width: 768px) {
        .register-container {
            padding: 28px 22px;
        }

        .register-header h1 {
            font-size: 24px;
        }
    }
</style>
