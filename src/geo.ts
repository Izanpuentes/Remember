export type Ring = [number, number][];

export interface Geometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: any;
}

function inRing(ring: Ring, lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(rings: Ring[], lng: number, lat: number): boolean {
  // El primer anillo es el contorno; el resto, huecos
  return inRing(rings[0], lng, lat) && !rings.slice(1).some((hole) => inRing(hole, lng, lat));
}

/** ¿Está el punto dentro de la geometría? (en plano lng/lat, suficiente para elegir país o provincia) */
export function contains(geometry: Geometry, lng: number, lat: number): boolean {
  const polygons: Ring[][] = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some((rings) => inPolygon(rings, lng, lat));
}

export function polygonsOf(geometry: Geometry): Ring[][] {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

/** Tamaño aproximado de la geometría en grados (el lado mayor de su caja) */
export function spanOf(geometry: Geometry): number {
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  for (const rings of polygonsOf(geometry)) {
    for (const [lng, lat] of rings[0]) {
      west = Math.min(west, lng);
      east = Math.max(east, lng);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
  }
  const midLat = ((south + north) / 2) * (Math.PI / 180);
  return Math.max(north - south, (east - west) * Math.cos(midLat));
}

/** Reduce una geometría muy detallada a unos `maxPoints` puntos, quitando puntos intermedios */
export function thin(geometry: Geometry, maxPoints: number): Geometry {
  const polygons = polygonsOf(geometry);
  const total = polygons.reduce((sum, rings) => sum + rings.reduce((s, ring) => s + ring.length, 0), 0);
  if (total <= maxPoints) return geometry;
  const step = Math.ceil(total / maxPoints);
  // Se quita el punto de cierre, se toma uno de cada `step` y se vuelve a cerrar el anillo
  const thinRing = (ring: Ring): Ring => {
    const kept = ring.slice(0, -1).filter((_, i) => i % step === 0);
    return [...kept, kept[0]];
  };
  const isValid = (ring: Ring) => ring.length >= 4;
  const thinned = polygons.flatMap((rings) => {
    const outline = thinRing(rings[0]);
    // Las islas que se quedan sin puntos suficientes desaparecen
    return isValid(outline) ? [[outline, ...rings.slice(1).map(thinRing).filter(isValid)]] : [];
  });
  return thinned.length > 0 ? { type: 'MultiPolygon', coordinates: thinned } : geometry;
}

function isClockwise(ring: Ring): boolean {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) sum += (ring[i + 1][0] - ring[i][0]) * (ring[i + 1][1] + ring[i][1]);
  return sum > 0;
}

/**
 * Ordena los anillos como espera el globo: contorno en sentido horario y huecos al revés.
 * El GeoJSON estándar va al contrario, y sin esto se pintaría todo el planeta menos el lugar.
 */
export function orient(geometry: Geometry): Geometry {
  const coordinates = polygonsOf(geometry).map((rings) =>
    rings.map((ring, i) => (isClockwise(ring) === (i === 0) ? ring : [...ring].reverse())),
  );
  return { type: 'MultiPolygon', coordinates };
}

/** Círculo alrededor de un punto, para lugares de los que no se conoce el contorno */
export function circle(lat: number, lng: number, radiusKm: number): Geometry {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos(lat * (Math.PI / 180)));
  const ring: Ring = [];
  for (let i = 0; i <= 24; i++) {
    const angle = (i / 24) * 2 * Math.PI;
    ring.push([lng + dLng * Math.cos(angle), lat + dLat * Math.sin(angle)]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}
