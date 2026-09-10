// Small fictional geography for the demo: Bay Area cities and ZIPs with
// approximate coordinates so distance and "city" resolution feel real.
export interface ZipInfo { zip: string; city: string; lat: number; lng: number }

export const ZIPS: ZipInfo[] = [
  { zip: '94601', city: 'Oakland', lat: 37.78, lng: -122.22 },
  { zip: '94607', city: 'Oakland', lat: 37.81, lng: -122.29 },
  { zip: '94611', city: 'Oakland', lat: 37.83, lng: -122.21 },
  { zip: '94621', city: 'Oakland', lat: 37.74, lng: -122.19 },
  { zip: '94702', city: 'Berkeley', lat: 37.87, lng: -122.29 },
  { zip: '94710', city: 'Berkeley', lat: 37.87, lng: -122.3 },
  { zip: '94541', city: 'Hayward', lat: 37.67, lng: -122.09 },
  { zip: '94544', city: 'Hayward', lat: 37.63, lng: -122.06 },
  { zip: '94560', city: 'Newark', lat: 37.52, lng: -122.03 },
  { zip: '94536', city: 'Fremont', lat: 37.56, lng: -121.99 },
  { zip: '94538', city: 'Fremont', lat: 37.5, lng: -121.96 },
  { zip: '94577', city: 'San Leandro', lat: 37.72, lng: -122.16 },
  { zip: '94520', city: 'Concord', lat: 37.98, lng: -122.03 },
  { zip: '94596', city: 'Walnut Creek', lat: 37.9, lng: -122.05 },
  { zip: '94014', city: 'Daly City', lat: 37.69, lng: -122.45 },
  { zip: '94015', city: 'Daly City', lat: 37.68, lng: -122.48 },
  { zip: '94401', city: 'San Mateo', lat: 37.57, lng: -122.32 },
  { zip: '94404', city: 'Foster City', lat: 37.55, lng: -122.27 },
  { zip: '94063', city: 'Redwood City', lat: 37.48, lng: -122.21 },
  { zip: '94301', city: 'Palo Alto', lat: 37.44, lng: -122.15 },
  { zip: '94086', city: 'Sunnyvale', lat: 37.37, lng: -122.02 },
  { zip: '95112', city: 'San Jose', lat: 37.34, lng: -121.88 },
  { zip: '95123', city: 'San Jose', lat: 37.24, lng: -121.83 },
  { zip: '95128', city: 'San Jose', lat: 37.32, lng: -121.94 },
  { zip: '95050', city: 'Santa Clara', lat: 37.35, lng: -121.95 },
];

const byZip = new Map(ZIPS.map((z) => [z.zip, z]));

export function zipInfo(zip: string): ZipInfo | undefined {
  return byZip.get(zip);
}
export function cityForZip(zip: string): string {
  return byZip.get(zip)?.city ?? 'Unknown';
}
export function distanceMiles(zipA: string, zipB: string): number | null {
  const a = byZip.get(zipA);
  const b = byZip.get(zipB);
  if (!a || !b) return null;
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la = (a.lat * Math.PI) / 180;
  const lb = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLng / 2) ** 2;
  const d = 2 * R * Math.asin(Math.sqrt(h));
  return Math.max(0.5, Math.round(d * 1.25 * 10) / 10); // road factor; same ZIP shows as 0.5 mi
}
export function mapsUrl(address: { street: string; city: string; state: string; zip: string }): string {
  const q = encodeURIComponent(`${address.street}, ${address.city}, ${address.state} ${address.zip}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
export function zipMapsUrl(zip: string): string {
  const info = byZip.get(zip);
  const q = encodeURIComponent(info ? `${info.city}, CA ${zip}` : zip);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
