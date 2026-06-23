<script>
	import Icon from './Icon.svelte';
	export let collection;
	$: cover = collection?.image || collection?.releases?.[0]?.image;
</script>

<a class="ccard" href={`/collection/${collection.id}`}>
	<div class="cover">
		{#if cover}
			<img src={cover} alt="" referrerpolicy="no-referrer" loading="lazy" />
		{:else}
			<div class="ph"><Icon name="collection" size={32} /></div>
		{/if}
		<div class="shade"></div>
		<div class="overlay">
			<h3>{collection.title}</h3>
			<div class="meta">
				<span><Icon name="bookmark" size={13} /> {collection.favorites_count ?? 0}</span>
				<span>💬 {collection.comment_count ?? 0}</span>
			</div>
		</div>
	</div>
</a>

<style>
	.ccard {
		display: block;
		border-radius: 16px;
		overflow: hidden;
		transition: transform 0.2s ease;
	}
	.ccard:hover {
		transform: translateY(-4px);
	}
	.cover {
		position: relative;
		aspect-ratio: 16/10;
		background: linear-gradient(135deg, #2a2540, #3a2030);
	}
	.cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.ph {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		color: var(--third-text-color);
	}
	.shade {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.85), transparent 60%);
	}
	.overlay {
		position: absolute;
		left: 14px;
		right: 14px;
		bottom: 12px;
	}
	.overlay h3 {
		font-size: 15px;
		font-weight: 700;
		color: #fff;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		text-shadow: 0 1px 6px rgba(0, 0, 0, 0.8);
	}
	.meta {
		display: flex;
		gap: 12px;
		margin-top: 6px;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.85);
	}
	.meta span {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
</style>
