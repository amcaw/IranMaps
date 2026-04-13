export interface StrikeFeature {
	lon: number;
	lat: number;
	date: string;
	layer: string;
	city: string;
	type: string;
	actor: string;
	country: string;
	province: string;
	siteType: string;
	source: string;
	vessel: string;
	flag: string;
}

export interface LayerMeta {
	id: string;
	label: string;
	color: string;
	count: number;
}

export interface StrikeData {
	meta: {
		layers: LayerMeta[];
		dates: string[];
		generated: string;
	};
	features: StrikeFeature[];
}

export interface UkraineLayerMeta {
	id: string;
	label: string;
	color: string;
	fillColor: string;
	fillOpacity: number;
	count: number;
	areaKm2: number;
}

export interface UkraineData {
	meta: {
		layers: UkraineLayerMeta[];
		generated: string;
	};
	type: 'FeatureCollection';
	features: Array<{
		type: 'Feature';
		geometry: { type: string; coordinates: any };
		properties: { layer: string };
	}>;
}
