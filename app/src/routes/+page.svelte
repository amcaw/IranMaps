<div class="landing">
	<h1>WarMaps</h1>
	<div class="maps">
		<a class="map-card" href="middle-east">
			<span class="card-title">Moyen-Orient</span>
			<span class="card-desc">Frappes au Moyen-Orient depuis fev. 2026</span>
		</a>
		<a class="map-card" href="ukraine">
			<span class="card-title">Ukraine</span>
			<span class="card-desc">Carte du controle territorial en Ukraine</span>
		</a>
		<a class="map-card" href="ukraine-timeline">
			<span class="card-title">Ukraine (timelapse)</span>
			<span class="card-desc">Évolution du front depuis fév. 2022</span>
		</a>
		<a class="map-card" href="middle-east-custom">
			<span class="card-title">Moyen-Orient – Personnaliser</span>
			<span class="card-desc">Choisir une vue et générer un code d'intégration</span>
		</a>
	</div>
</div>

<style>
	.landing {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 20px;
		background: var(--bg);
	}

	h1 {
		font-size: 28px;
		font-weight: 700;
		margin-bottom: 32px;
		letter-spacing: -0.5px;
	}

	.maps {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		justify-content: center;
	}

	.map-card {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 24px 32px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--surface);
		text-decoration: none;
		color: var(--text);
		transition: border-color 0.15s;
		min-width: 280px;
		width: 280px;
	}

	.map-card:hover {
		border-color: var(--accent);
	}


	.card-title {
		font-size: 18px;
		font-weight: 600;
	}

	.card-desc {
		font-size: 13px;
		color: var(--text-dim);
	}
</style>
