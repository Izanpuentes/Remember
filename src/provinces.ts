import { feature } from 'topojson-client';
import { contains, type Geometry } from './geo';

export interface Province {
  id: string;
  name: string;
  /** Punto representativo, donde se coloca el pin si no se tocó dentro de la provincia */
  lat: number;
  lng: number;
  geometry: Geometry;
}

const cache = new Map<string, Promise<Province[]>>();

/** Provincias/estados de un país. Van dentro de la app y se cargan solo cuando hacen falta. */
export function loadProvinces(code: string): Promise<Province[]> {
  let provinces = cache.get(code);
  if (!provinces) {
    provinces = fetch(`${import.meta.env.BASE_URL}admin1/${code}.json`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`Sin provincias para ${code}`))))
      .then((topo) => {
        const features: any[] = (feature(topo, topo.objects[Object.keys(topo.objects)[0]]) as any).features;
        return features
          .filter((f) => f.geometry && f.properties.n)
          .map((f) => ({
            id: f.properties.id,
            name: f.properties.n,
            lat: f.properties.y,
            lng: f.properties.x,
            geometry: f.geometry,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'es'));
      })
      .catch(() => []);
    cache.set(code, provinces);
  }
  return provinces;
}

export function findProvince(provinces: Province[], lat: number, lng: number): Province | undefined {
  return provinces.find((p) => contains(p.geometry, lng, lat));
}
