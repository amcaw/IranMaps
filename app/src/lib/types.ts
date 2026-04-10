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
