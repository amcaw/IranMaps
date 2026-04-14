import { writable } from 'svelte/store';

function createThemeStore() {
	const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
	const { subscribe, set } = writable(mq?.matches ?? false);

	if (mq) {
		mq.addEventListener('change', (e) => set(e.matches));
	}

	return { subscribe };
}

export const isDarkStore = createThemeStore();
