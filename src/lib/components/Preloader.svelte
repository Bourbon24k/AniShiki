<script>
    export let size = 'medium';
</script>

<div class="preloader-container {size}">
    <div class="preloader">
        <div class="spinner"></div>
    </div>
    <span class="preloader-text">Загрузка...</span>
</div>

<style>
    .preloader-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 100%;
        padding: 40px;
        gap: 16px;
    }
    
    .preloader-container.small {
        padding: 20px;
    }
    
    .preloader-container.large {
        padding: 60px;
        min-height: 300px;
    }
    
    .preloader {
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid var(--surface-3);
        border-top-color: var(--accent);
        border-radius: 50%;
        animation: spin 0.9s linear infinite;
    }
    
    .small .spinner {
        width: 24px;
        height: 24px;
        border-width: 2px;
    }
    
    .large .spinner {
        width: 60px;
        height: 60px;
        border-width: 4px;
    }
    
    .preloader-text {
        color: var(--secondary-text-color);
        font-size: 14px;
    }
    
    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>
