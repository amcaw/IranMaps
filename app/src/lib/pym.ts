/**
 * Shared pym.Child wrapper.
 * Call initPym() in onMount, then sendHeight() after any DOM change.
 */
import { onMount } from 'svelte';
import pym from 'pym.js';

let pymChild: any = null;

export function initPym() {
	onMount(() => {
		if (typeof window !== 'undefined') {
			pymChild = new pym.Child({ polling: 500 });

			// Continuously track height changes via ResizeObserver
			const root = document.querySelector('.page-root');
			if (root) {
				new ResizeObserver(() => pymChild?.sendHeight()).observe(root);
			}
		}
	});
}

export function sendHeight() {
	if (pymChild) {
		setTimeout(() => pymChild.sendHeight(), 50);
	}
}
