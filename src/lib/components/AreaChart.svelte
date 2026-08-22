<script>
	/**
	 * График-площадь с разбором по дням.
	 *
	 * Просто линия мало что говорит: непонятно, какой день где. Поэтому здесь
	 * есть точки, вертикальная направляющая и подпись «дата — сколько серий»,
	 * которая ходит за курсором, а на телефоне — за пальцем.
	 */
	export let points = []; // [{ value, label, full? }]
	export let height = 170;
	export let color = 'var(--primary-color)';

	const WIDTH = 600; // своя система координат, растягивается по ширине
	const PAD = 10;

	let box; // элемент-обёртка, по нему считаем позицию курсора
	let hover = -1;

	$: values = points.map((p) => Number(p.value) || 0);
	$: max = Math.max(1, ...values);
	$: coords = values.map((v, i) => ({
		x: values.length > 1 ? PAD + (i / (values.length - 1)) * (WIDTH - PAD * 2) : WIDTH / 2,
		y: height - PAD - (v / max) * (height - PAD * 3)
	}));
	$: line = smooth(coords);
	$: area = line ? `${line} L ${WIDTH - PAD} ${height} L ${PAD} ${height} Z` : '';
	$: total = values.reduce((sum, v) => sum + v, 0);
	$: current = hover >= 0 && hover < points.length ? points[hover] : null;

	/** Кубическая интерполяция по средним точкам — линия без изломов. */
	function smooth(list) {
		if (!list.length) return '';
		if (list.length === 1) return `M ${PAD} ${list[0].y} L ${WIDTH - PAD} ${list[0].y}`;
		let d = `M ${list[0].x} ${list[0].y}`;
		for (let i = 1; i < list.length; i++) {
			const prev = list[i - 1];
			const curr = list[i];
			const midX = (prev.x + curr.x) / 2;
			d += ` C ${midX} ${prev.y}, ${midX} ${curr.y}, ${curr.x} ${curr.y}`;
		}
		return d;
	}

	/** Ближайшая к курсору точка: по ней и показываем подпись. */
	function pick(event) {
		if (!box || !points.length) return;
		const rect = box.getBoundingClientRect();
		const clientX = event.touches?.[0]?.clientX ?? event.clientX;
		const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
		// Переводим долю ширины в индекс с учётом внутренних отступов графика.
		const usable = (WIDTH - PAD * 2) / WIDTH;
		const shifted = Math.min(1, Math.max(0, (ratio - PAD / WIDTH) / usable));
		hover = Math.round(shifted * (points.length - 1));
	}

	function leave() {
		hover = -1;
	}

	/** Позиция подписи в процентах ширины — чтобы не уезжала за край. */
	$: tipLeft = current ? Math.min(88, Math.max(12, (coords[hover].x / WIDTH) * 100)) : 50;
</script>

{#if points.length}
	<div
		class="chart"
		bind:this={box}
		on:pointermove={pick}
		on:pointerdown={pick}
		on:pointerleave={leave}
		on:touchmove|passive={pick}
		on:touchend={leave}
		role="img"
		aria-label={`Динамика просмотра: всего ${total} серий за ${points.length} точек`}
	>
		<div class="head">
			<span class="sum">{total} серий за период</span>
			{#if current}
				<span class="tip-inline">{current.full || current.label} — <b>{current.value}</b></span>
			{/if}
		</div>

		<svg viewBox={`0 0 ${WIDTH} ${height}`} preserveAspectRatio="none">
			<defs>
				<linearGradient id="area-fade" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color={color} stop-opacity="0.4" />
					<stop offset="100%" stop-color={color} stop-opacity="0" />
				</linearGradient>
			</defs>

			{#each [0.25, 0.5, 0.75] as ratio}
				<line x1="0" x2={WIDTH} y1={height * ratio} y2={height * ratio} class="grid" />
			{/each}

			<path d={area} fill="url(#area-fade)" />
			<path
				d={line}
				fill="none"
				stroke={color}
				stroke-width="3"
				stroke-linecap="round"
				vector-effect="non-scaling-stroke"
			/>

			{#if current}
				<line x1={coords[hover].x} x2={coords[hover].x} y1="0" y2={height} class="cursor" />
			{/if}

			{#each coords as c, i}
				<circle
					cx={c.x}
					cy={c.y}
					r={i === hover ? 6 : 3.5}
					class="point"
					class:on={i === hover}
					fill={color}
					vector-effect="non-scaling-stroke"
				/>
			{/each}
		</svg>

		{#if current}
			<div class="tip" style={`left:${tipLeft}%`}>
				<b>{current.value}</b>
				<span>{current.full || current.label}</span>
			</div>
		{/if}

		<div class="labels">
			{#each points as p, i}
				{#if i === 0 || i === points.length - 1 || (points.length > 4 && i === Math.floor(points.length / 2))}
					<span style={`left:${points.length > 1 ? (coords[i].x / WIDTH) * 100 : 50}%`}>{p.label}</span>
				{/if}
			{/each}
		</div>
	</div>
{/if}

<style>
	.chart {
		position: relative;
		touch-action: pan-y;
		cursor: crosshair;
	}
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 6px;
		min-height: 18px;
	}
	.sum {
		font-size: 12.5px;
		color: var(--third-text-color);
	}
	.tip-inline {
		font-size: 12.5px;
		color: var(--secondary-text-color);
		white-space: nowrap;
	}
	.tip-inline b {
		color: var(--text-color);
	}
	svg {
		display: block;
		width: 100%;
		height: 170px;
		overflow: visible;
	}
	.grid {
		stroke: var(--glass-border);
		stroke-width: 1;
		stroke-dasharray: 4 6;
		vector-effect: non-scaling-stroke;
	}
	.cursor {
		stroke: var(--secondary-text-color);
		stroke-width: 1;
		stroke-dasharray: 3 4;
		vector-effect: non-scaling-stroke;
	}
	/* Точки рисуются в растянутой системе координат — сжимаем обратно,
	   иначе кружки превращаются в эллипсы. */
	.point {
		transform-box: fill-box;
		transform-origin: center;
		opacity: 0.75;
		transition: r 0.12s ease, opacity 0.12s ease;
	}
	.point.on {
		opacity: 1;
		stroke: var(--background-color);
		stroke-width: 2;
	}
	.tip {
		position: absolute;
		top: 22px;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1px;
		padding: 6px 11px;
		border-radius: 10px;
		background: var(--elevated-color);
		border: 1px solid var(--glass-border);
		box-shadow: 0 8px 22px rgba(0, 0, 0, 0.4);
		pointer-events: none;
		white-space: nowrap;
		z-index: 2;
	}
	.tip b {
		font-size: 15px;
		font-weight: 800;
	}
	.tip span {
		font-size: 11px;
		color: var(--third-text-color);
	}
	.labels {
		position: relative;
		height: 18px;
		margin-top: 4px;
	}
	.labels span {
		position: absolute;
		transform: translateX(-50%);
		font-size: 11.5px;
		color: var(--third-text-color);
		white-space: nowrap;
	}
</style>
