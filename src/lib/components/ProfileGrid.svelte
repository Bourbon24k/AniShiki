<script>
	import Icon from './Icon.svelte';
	export let profiles = [];
	export let empty = 'Список пуст';
</script>

{#if profiles.length === 0}
	<p class="empty">{empty}</p>
{:else}
	<div class="grid">
		{#each profiles as p (p.id)}
			<a class="pcard" href={`/profile/${p.id}`}>
				<div class="ava">
					{#if p.avatar}
						<img src={p.avatar} alt="" referrerpolicy="no-referrer" />
					{:else}
						<Icon name="user" size={26} />
					{/if}
					{#if p.is_online}<span class="online"></span>{/if}
				</div>
				<span class="login">{p.login}</span>
				{#if p.status}<span class="status">{p.status}</span>{/if}
			</a>
		{/each}
	</div>
{/if}

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 14px;
	}
	.pcard {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 18px 12px;
		border-radius: 16px;
		background: var(--alt-background-color);
		border: 1px solid var(--glass-border);
		color: var(--text-color);
		text-align: center;
		transition: transform 0.15s ease, border-color 0.2s ease;
	}
	.pcard:hover {
		transform: translateY(-3px);
		border-color: var(--primary-color);
	}
	.ava {
		position: relative;
		width: 64px;
		height: 64px;
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
	.online {
		position: absolute;
		bottom: 2px;
		right: 2px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--watching-color);
		border: 2px solid var(--alt-background-color);
	}
	.login {
		font-weight: 600;
		font-size: 14px;
	}
	.status {
		font-size: 12px;
		color: var(--third-text-color);
		display: -webkit-box;
		-webkit-line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.empty {
		text-align: center;
		padding: 60px;
		color: var(--secondary-text-color);
	}
	@media (max-width: 768px) {
		.grid {
			grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
			gap: 10px;
		}
	}
</style>
