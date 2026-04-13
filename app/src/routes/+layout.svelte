<script>
	import '../app.css';
	import { onMount } from 'svelte';
	let { children } = $props();

	onMount(() => {
		if (/Mac|iPhone|iPad/.test(navigator.userAgent)) {
			document.body.classList.add('is-mac');
		}
	});
</script>

{@render children()}
