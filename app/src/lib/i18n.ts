export const fr: Record<string, string> = {
  // Layer names
  'US & Israeli Strikes in Iran': 'Frappes américaines et israéliennes en Iran',
  'Iran & Axis Response': 'Riposte de l\'Iran et de l\'Axe',
  'Israeli Strikes in Lebanon': 'Frappes israéliennes au Liban',
  'US & Israeli Strikes in Iraq': 'Frappes américaines et israéliennes en Irak',
  'Iran Strikes against Civilian Vessels': 'Frappes iraniennes contre des navires civils',
  'Hezbollah Attacks in Lebanon': 'Attaques du Hezbollah au Liban',

  // Strike types / subcategories
  'Reported Airstrike': 'Frappe aérienne signalée',
  'Confirmed Airstrike': 'Frappe aérienne confirmée',
  'Rocket Attack': 'Attaque à la roquette',
  'Report of Explosion with Footage': 'Explosion signalée avec images',
  'Drone Attack': 'Attaque de drone',
  'Missile Attack': 'Attaque de missile',
  'Direct Engagement': 'Engagement direct',
  'Mortar Attack': 'Tir de mortier',
  'Mortar Fire': 'Tir de mortier',
  'Air Defense Activity': 'Activité de défense aérienne',
  'Anti-Tank Fire': 'Tir antichar',
  'Drone & Missile Attack': 'Attaque de drone et missile',
  'Drone & Rocket Attack': 'Attaque de drone et roquette',
  'Small Arms Engagement': 'Engagement aux armes légères',
  'Evac Notice': 'Avis d\'évacuation',
  'IED': 'EEI (engin explosif improvisé)',
  'FPV drone': 'Drone FPV',
  'Ground Activity': 'Activité au sol',
  'Drone': 'Drone',
  'Other (see note)': 'Autre (voir note)',
  'Other': 'Autre',
  'unknown': 'Inconnu',
  'Unknown': 'Inconnu',

  // UI
  'Strikes across the Middle East': 'Frappes au Moyen-Orient',
  'US–Israel vs Iran crisis, starting Feb 28, 2026': 'Guerre États-Unis–Israël contre Iran, depuis le 28 fév. 2026',
  'strikes': 'frappes',
  'Loading strike data...': 'Chargement des données…',
};

export function t(key: string): string {
  return fr[key] ?? key;
}
