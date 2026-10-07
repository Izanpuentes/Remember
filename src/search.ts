import { circle, orient, spanOf, thin, type Geometry } from './geo';

// Buscador de lugares de OpenStreetMap (Nominatim). Es la única parte de la app que necesita internet:
// el contorno del lugar elegido se guarda con el viaje, así que después todo funciona sin conexión.
// Condiciones de uso: una búsqueda por segundo como mucho y nada de autocompletar mientras se escribe.
// https://operations.osmfoundation.org/policies/nominatim/
const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const MAX_RESULTS = 8;
// Simplificación del contorno que hace el servidor, en grados (~150 m)
const SERVER_SIMPLIFY = 0.0015;
// Tope de puntos por contorno, para que un país entero no ocupe cientos de KB en cada viaje
const MAX_POINTS = 1500;
// Radio del círculo para lugares que en OpenStreetMap son solo un punto
const POINT_RADIUS_KM = 1.5;

export interface SearchResult {
  id: string;
  name: string;
  /** Resto de la dirección: comarca, región, país… */
  detail: string;
  country: string;
  lat: number;
  lng: number;
  geometry: Geometry;
  /** Tamaño del lugar en grados, para decidir el zoom */
  span: number;
}

export async function searchPlaces(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    polygon_geojson: '1',
    polygon_threshold: String(SERVER_SIMPLIFY),
    'accept-language': 'es',
    limit: String(MAX_RESULTS),
  });
  const res = await fetch(`${ENDPOINT}?${params}`);
  if (!res.ok) throw new Error(`Búsqueda fallida (${res.status})`);
  const places: any[] = await res.json();

  return places.map((p) => {
    const lat = Number(p.lat);
    const lng = Number(p.lon);
    const hasOutline = p.geojson?.type === 'Polygon' || p.geojson?.type === 'MultiPolygon';
    const geometry = orient(hasOutline ? thin(p.geojson, MAX_POINTS) : circle(lat, lng, POINT_RADIUS_KM));
    const name: string = p.name || String(p.display_name).split(',')[0];
    const parts = String(p.display_name)
      .split(',')
      .map((part) => part.trim());
    return {
      id: `${p.osm_type}${p.osm_id}`,
      name,
      detail: parts.filter((part) => part !== name).join(', '),
      country: p.address?.country ?? name,
      lat,
      lng,
      geometry,
      span: spanOf(geometry),
    };
  });
}
