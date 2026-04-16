<script lang="ts">
	import { t } from '$lib/i18n';
	import type { Snippet } from 'svelte';

	let {
		layers,
		visibleLayers = $bindable(),
		countsByLayer,
		extra
	}: {
		layers: Array<{ id: string; label: string; color: string; count: number; areaKm2?: number }>;
		visibleLayers: Set<string>;
		countsByLayer: Record<string, number>;
		extra?: Snippet;
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
				<span class="layer-count">
				{#if layer.areaKm2 != null}
					{layer.areaKm2.toLocaleString()} km²
				{:else}
					{(countsByLayer[layer.id] || 0).toLocaleString()}
				{/if}
			</span>
			</button>
		{/each}
		{#if extra}
			{@render extra()}
		{/if}
	</div>
</div>

<style>
	.legend {
		background: var(--bg);
		padding: 10px 16px;
	}

	.layers {
		columns: 3;
		column-gap: 16px;
	}

	@media (max-width: 1024px) {
		.layers {
			columns: 2;
		}
	}

	@media (max-width: 640px) {
		.layers {
			columns: 1;
		}
	}

	.layer-row {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 3px 6px;
		border-radius: 5px;
		border: none;
		background: transparent;
		color: var(--text);
		cursor: pointer;
		font-size: 12px;
		text-align: left;
		transition: opacity 0.15s;
		line-height: 1.3;
		white-space: normal;
	}

	.layer-row:hover {
		background: var(--surface);
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

	.layer-count {
		color: var(--text-dim);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}

	@media (max-width: 640px) {
		.legend {
			padding: 8px 10px;
		}

		.layer-row {
			font-size: 11px;
			gap: 5px;
			padding: 2px 4px;
		}

		.layer-count {
			font-size: 10px;
		}
	}
</style>
