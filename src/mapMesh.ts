import * as THREE from 'three';
import ConicPolygonGeometry from 'three-conic-polygon-geometry';
import GeoJsonGeometry from 'three-geojson-geometry';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { polygonsOf, type Geometry } from './geo';

// globe.gl dibuja cada trozo de cada polígono (cada isla) como un objeto aparte: con el mapa del mundo
// son más de 1600 relleno + borde, y cada zona visitada suma más. Con muchas zonas el globo iba a tirones.
// Aquí se juntan todos los rellenos en una sola malla y todos los bordes en otra, y el globo los
// dibuja de una vez, haya las zonas que haya.

// Mismas medidas que usa globe.gl para sus polígonos
const GLOBE_RADIUS = 100;
const CURVATURE_RESOLUTION = 5;

export interface ColoredShape {
  geometry: Geometry;
  color: string;
}

/** Las mallas no se pueden tocar: los toques atraviesan hasta el globo, que da la latitud y longitud */
function ignoreClicks<T extends THREE.Object3D>(obj: T): T {
  obj.raycast = () => {};
  return obj;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = parts.length > 0 ? mergeGeometries(parts, false) : new THREE.BufferGeometry();
  parts.forEach((p) => p.dispose());
  return merged ?? new THREE.BufferGeometry();
}

/**
 * Rellenos de varias formas en una sola malla, a `altitude` radios sobre la superficie.
 * `userData.ranges` guarda qué vértices son de cada forma, para poder cambiarles el color con `recolor`.
 */
export function fillMesh(shapes: ColoredShape[], altitude: number): THREE.Mesh {
  const ranges: [number, number][] = [];
  let vertices = 0;
  const parts = shapes.flatMap((shape) => {
    const start = vertices;
    const pieces = polygonsOf(shape.geometry).map((rings) => {
      const piece = new ConicPolygonGeometry(rings, 0, GLOBE_RADIUS * (1 + altitude), false, true, false, CURVATURE_RESOLUTION);
      vertices += piece.attributes.position.count;
      return piece;
    });
    ranges.push([start, vertices]);
    return pieces;
  });

  const geometry = merge(parts);
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vertices * 3), 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  mesh.userData.ranges = ranges;
  recolor(mesh, shapes.map((s) => s.color));
  return ignoreClicks(mesh);
}

/** Cambia el color de cada forma de una malla hecha con `fillMesh` (en el mismo orden) */
export function recolor(mesh: THREE.Mesh, colors: string[]): void {
  const attribute = mesh.geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!attribute) return;
  const ranges: [number, number][] = mesh.userData.ranges;
  const color = new THREE.Color();
  ranges.forEach(([start, end], i) => {
    color.set(colors[i]);
    for (let v = start; v < end; v++) attribute.setXYZ(v, color.r, color.g, color.b);
  });
  attribute.needsUpdate = true;
}

/** Bordes de varias formas en una sola malla de líneas */
export function strokeLines(geometries: Geometry[], altitude: number, color: string): THREE.LineSegments {
  // Un pelo por encima del relleno, como hace globe.gl
  const radius = GLOBE_RADIUS * (1 + altitude + 1e-4);
  const parts = geometries.map((g) => new GeoJsonGeometry(g, radius, CURVATURE_RESOLUTION));
  return ignoreClicks(new THREE.LineSegments(merge(parts), new THREE.LineBasicMaterial({ color })));
}

export function dispose(obj: THREE.Mesh | THREE.LineSegments): void {
  obj.removeFromParent();
  obj.geometry.dispose();
  (obj.material as THREE.Material).dispose();
}
