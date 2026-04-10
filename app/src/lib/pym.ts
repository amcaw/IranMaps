import { onMount } from 'svelte';
import pym from 'pym.js';

let pymChild: any = null;

export function initPym() {
	onMount(() => {
		if (typeof window !== 'undefined') {
			pymChild = new pym.Child({ polling: 500 });
		}
	});
}

export function sendHeight() {
	if (pymChild) {
		setTimeout(() => pymChild.sendHeight(), 50);
	}
}
