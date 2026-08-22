<script>
	/**
	 * Кольцевая диаграмма распределения по спискам.
	 * Рисуем сами на SVG: тянуть ради одного графика библиотеку не хочется,
	 * а тут всего-то дуги по окружности.
	 */
	export let segments = []; // [{ label, value, color }]
	export let size = 190;
	export let thickness = 26;

	$: total = segments.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
	$: radius = (size - thickness) / 2;
	$: circumference = 2 * Math.PI * radius;
	$: arcs = build(segments, total, circumference);

	function build(list, sum, circle) {
		if (!sum) return [];
		let offset = 0;
		return list
			.filter((s) => Number(s.value) > 0)
			.map((s) => {
				const length = (Number(s.value) / sum) * circle;
				const arc = { ...s, length, offset, gap: circle - length };
				offset += length;
				return arc;
			});
	}
</script>

{#if total > 0}
	<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Распределение по спискам">
		<g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
			{#each arcs as arc (arc.label)}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke={arc.color}
					stroke-width={thickness}
					stroke-dasharray={`${arc.length} ${arc.gap}`}
					stroke-dashoffset={-arc.offset}
				>
					<title>{arc.label}: {arc.value}</title>
				</circle>
			{/each}
		</g>
		<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" class="total">
			{total}
		</text>
	</svg>
{/if}

<style>
	svg {
		flex-shrink: 0;
	}
	circle {
		transition: stroke-dasharray 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.total {
		font-size: 26px;
		font-weight: 800;
		fill: var(--text-color);
	}
</style>
