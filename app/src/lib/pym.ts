import { onMount } from 'svelte';
import pym from 'pym.js';

// Keep the pym child instance around so we can notify the parent later.
let child: any = null;
let resizeObserver: ResizeObserver | null = null;

export function initPym() {
	onMount(() => {
		if (typeof window === 'undefined') return;

		child = new pym.Child({ polling: 0 });
		// Pym already sends an initial height; keep it in sync on DOM changes.
		resizeObserver = new ResizeObserver(() => child?.sendHeight());
		resizeObserver.observe(document.body);
		child.sendHeight();

		return () => {
			resizeObserver?.disconnect();
			resizeObserver = null;
			child?.remove?.();
			child = null;
		};
	});
}

export function sendHeight() {
	if (!child) return;
	requestAnimationFrame(() => child?.sendHeight());
}
