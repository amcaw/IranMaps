<script lang="ts">
	import type { LayerMeta } from '$lib/types';
	import { t } from '$lib/i18n';

	let {
		layers,
		visibleLayers = $bindable(),
		countsByLayer
	}: {
		layers: LayerMeta[];
		visibleLayers: Set<string>;
		countsByLayer: Record<string, number>;
	} = $props();

	function toggle(id: string) {
		const next = new Set(visibleLayers);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		visibleLayers = next;
	}
</script>

<div class="legend">
	<div class="layers">
		{#each layers as layer}
			<button
				class="layer-row"
				class:dimmed={!visibleLayers.has(layer.id)}
				onclick={() => toggle(layer.id)}
			>
				<span class="dot" style="background: {layer.color}"></span>
				<span class="layer-label">{t(layer.label)}</span>
				<span class="layer-count">{(countsByLayer[layer.id] || 0).toLocaleString()}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.legend {
		background: var(--bg);
		padding: 14px 16px;
	}

.layers {
		columns: 3;
		column-gap: 12px;
	}

	@media (max-width: 768px) {
		.layers {
			columns: 1;
		}
	}

	.layer-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 6px;
		border-radius: 5px;
		border: none;
		background: transparent;
		color: var(--text);
		cursor: pointer;
		font-size: 12px;
		text-align: left;
		transition: opacity 0.15s;
		line-height: 1.3;
		break-inside: avoid;
	}

	.layer-row:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.layer-row.dimmed {
		opacity: 0.35;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.layer-label {
		white-space: nowrap;
	}

.layer-count {
		color: var(--text-dim);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}
</style>
