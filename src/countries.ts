import { feature } from 'topojson-client';
import world from 'world-atlas/countries-50m.json';
import iso from 'i18n-iso-countries';
import es from 'i18n-iso-countries/langs/es.json';
import { contains, type Geometry } from './geo';

iso.registerLocale(es);

export interface CountryFeature {
  type: 'Feature';
  id?: string;
  properties: { name: string };
  geometry: Geometry;
}

const topo = world as any;

export const countries: CountryFeature[] = (feature(topo, topo.objects.countries) as any).features;

/** Clave estable del país (código ISO numérico, o el nombre si el mapa no trae código) */
export function countryKey(f: CountryFeature): string {
  return f.id ?? f.properties.name;
}

export function countryName(f: CountryFeature): string {
  const alpha2 = f.id ? iso.numericToAlpha2(f.id) : undefined;
  return (alpha2 && iso.getName(alpha2, 'es')) || f.properties.name;
}

// Natural Earth (de donde salen las provincias) no usa el código ISO en estos países
const ADMIN_CODE_BY_ISO: Record<string, string> = { ESH: 'SAH', PSE: 'PSX', SSD: 'SDS' };
const ADMIN_CODE_BY_NAME: Record<string, string> = { 'N. Cyprus': 'CYN', Somaliland: 'SOL', Kosovo: 'KOS' };

/** Código del fichero de provincias del país (public/admin1/<código>.json) */
export function adminCode(f: CountryFeature): string | undefined {
  const alpha3 = f.id ? iso.numericToAlpha3(f.id) : undefined;
  return alpha3 ? (ADMIN_CODE_BY_ISO[alpha3] ?? alpha3) : ADMIN_CODE_BY_NAME[f.properties.name];
}

export function findCountry(lat: number, lng: number): CountryFeature | undefined {
  return countries.find((f) => contains(f.geometry, lng, lat));
}
