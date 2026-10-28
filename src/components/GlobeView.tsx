import { useEffect, useRef } from 'react';
import Globe from 'globe.gl';
import type * as THREE from 'three';
import { adminCode, countries, countryKey, countryName, findCountry, type CountryFeature } from '../countries';
import { dispose, fillMesh, recolor, strokeLines, type ColoredShape } from '../mapMesh';
import { loadProvinces } from '../provinces';
import type { PickedPlace, Trip } from '../types';

const OCEAN = '#0d1b33';
const LAND = '#26375a';
const BORDER = '#0a1222';
// Alturas sobre la superficie, en radios del globo. Deben quedar por debajo de MIN_ALTITUDE.
const COUNTRY_ALTITUDE = 0.004;
const AREA_ALTITUDE = 0.007;
const PIN_ALTITUDE = 0.008;
// Lo más cerca que puede bajar la cámara (~130 km): lo justo para distinguir un pueblo
const MIN_ALTITUDE = 0.02;
const MAX_ALTITUDE = 2;
const LABEL_LAYOUT_INTERVAL = 150;
// Caja de la cabeza del pin respecto a su punta, en píxeles
const PIN_BOX = { halfWidth: 12, height: 30 };
// Zona que cuenta como tocar el pin: el elemento entero (44 × 44 px), que acaba en la punta
const PIN_TAP = { halfWidth: 22, height: 44 };
// Un toque que se mueve más o dura más que esto es un gesto para mover el globo, no un toque
const TAP_SLOP = 10;
const TAP_TIME = 500;
const LABEL_GAP = 4;

/** Altura de cámara a la que un lugar de `span` grados ocupa más o menos un tercio del ancho de pantalla */
export function altitudeForSpan(span: number): number {
  return Math.min(MAX_ALTITUDE, Math.max(MIN_ALTITUDE, span * 0.125));
}

const countryKeys = countries.map(countryKey);

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

interface Props {
  trips: Trip[];
  /** Al cambiar, la cámara vuela a ese punto */
  focus: { lat: number; lng: number; altitude: number; nonce: number } | null;
  onPickPlace: (place: PickedPlace) => void;
  onPickTrip: (id: string) => void;
}

/** Altitud de cámara a la que el globo cabe entero en pantalla (en vertical manda el ancho) */
function fitAltitude(width: number, height: number): number {
  const halfV = (50 / 2) * (Math.PI / 180);
  const halfH = Math.atan(Math.tan(halfV) * (width / height));
  return 1.12 / Math.sin(Math.min(halfV, halfH)) - 1;
}

export default function GlobeView({ trips, focus, onPickPlace, onPickTrip }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  const tripsRef = useRef(trips);
  const pins = useRef(new Map<string, HTMLElement>());
  // El globo dibuja los países y, encima, las zonas visitadas (provincias o lugares del buscador).
  // Son mallas únicas (ver mapMesh.ts), no polígonos de globe.gl.
  const countryMesh = useRef<THREE.Mesh | null>(null);
  const areaMesh = useRef<THREE.Mesh | null>(null);
  // Hay que recolocar las etiquetas: se ha movido la cámara o han cambiado los pines
  const labelsDirty = useRef(true);
  const callbacks = useRef({ onPickPlace, onPickTrip });
  callbacks.current = { onPickPlace, onPickTrip };

  useEffect(() => {
    const el = container.current!;
    const globe: any = new (Globe as any)(el);
    globeRef.current = globe;

    // Momento del último toque en un pin: el globo también lo recibe como toque en el mapa y hay que ignorarlo
    let pinTappedAt = 0;

    const pick = ({ lat, lng }: { lat: number; lng: number }) => {
      if (performance.now() - pinTappedAt < TAP_TIME) return;
      const country: CountryFeature | undefined = findCountry(lat, lng);
      // Las islas más pequeñas no están dibujadas: se puede pinchar en cualquier punto
      callbacks.current.onPickPlace(
        country
          ? { lat, lng, countryId: countryKey(country), adminCode: adminCode(country), place: countryName(country) }
          : { lat, lng, place: '' },
      );
    };

    globe
      .width(el.clientWidth)
      .height(el.clientHeight)
      .backgroundColor('#05070f')
      .atmosphereColor('#6ea8ff')
      .atmosphereAltitude(0.17)
      .onGlobeClick(pick)
      .htmlLat('lat')
      .htmlLng('lng')
      .htmlAltitude(PIN_ALTITUDE)
      .htmlElement((trip: Trip) => {
        // Los toques en los pines se detectan en `onPointerUp`: el pin no los recibe (ver styles.css)
        const pin = document.createElement('div');
        pin.className = 'pin';
        pin.style.setProperty('--pin-color', trip.color);
        pin.innerHTML = '<span class="pin-head"></span><span class="pin-label hidden"></span>';
        pin.lastElementChild!.textContent = trip.province ?? trip.place;
        pins.current.set(trip.id, pin);
        return pin;
      });

    // Oculta los pines que quedan en la cara oculta del globo. Se llama para todos los pines con cada
    // movimiento de cámara: solo se toca el pin si cambia, para no recalcular estilos a cada fotograma.
    globe.htmlElementVisibilityModifier?.((pin: HTMLElement, isVisible: boolean) => {
      const hidden = isVisible ? '' : '1';
      if (pin.dataset.hidden === hidden) return;
      pin.dataset.hidden = hidden;
      pin.style.opacity = isVisible ? '1' : '0';
    });

    // Si los pines recibieran los toques, un dedo que cae en un pin no le llegaría al globo: al pellizcar
    // para hacer zoom, el globo solo veía el otro dedo y giraba. Así que los toques van todos al globo
    // y aquí se mira si un toque corto, con un solo dedo y sin moverse, ha caído en un pin.
    const pinAt = (x: number, y: number): Trip | undefined => {
      let nearest: Trip | undefined;
      let nearestDistance = Infinity;
      for (const trip of tripsRef.current) {
        const pin = pins.current.get(trip.id);
        if (!pin || pin.dataset.hidden) continue;
        const tip = globe.getScreenCoords(trip.lat, trip.lng, PIN_ALTITUDE);
        if (Math.abs(x - tip.x) > PIN_TAP.halfWidth || y > tip.y || y < tip.y - PIN_TAP.height) continue;
        // Con varios pines juntos, el que tenga la cabeza más cerca del dedo
        const distance = Math.hypot(x - tip.x, y - (tip.y - PIN_BOX.height / 2));
        if (distance < nearestDistance) {
          nearest = trip;
          nearestDistance = distance;
        }
      }
      return nearest;
    };

    const fingers = new Set<number>();
    let tap: { pointerId: number; x: number; y: number; time: number } | null = null;
    const onPointerDown = (ev: PointerEvent) => {
      fingers.add(ev.pointerId);
      tap = fingers.size === 1 ? { pointerId: ev.pointerId, x: ev.clientX, y: ev.clientY, time: performance.now() } : null;
    };
    const onPointerUp = (ev: PointerEvent) => {
      fingers.delete(ev.pointerId);
      if (ev.type !== 'pointerup' || tap?.pointerId !== ev.pointerId) return;
      const isTap =
        Math.hypot(ev.clientX - tap.x, ev.clientY - tap.y) < TAP_SLOP && performance.now() - tap.time < TAP_TIME;
      tap = null;
      if (!isTap) return;
      const rect = el.getBoundingClientRect();
      const trip = pinAt(ev.clientX - rect.left, ev.clientY - rect.top);
      if (!trip) return;
      pinTappedAt = performance.now();
      callbacks.current.onPickTrip(trip.id);
    };
    // En fase de captura, para enterarse antes que el globo (que lanza su toque un fotograma después)
    el.addEventListener('pointerdown', onPointerDown, true);
    el.addEventListener('pointerup', onPointerUp, true);
    el.addEventListener('pointercancel', onPointerUp, true);

    const countriesFill = fillMesh(
      countries.map((f) => ({ geometry: f.geometry, color: LAND })),
      COUNTRY_ALTITUDE,
    );
    const borders = strokeLines(
      countries.map((f) => f.geometry),
      COUNTRY_ALTITUDE,
      BORDER,
    );
    countryMesh.current = countriesFill;
    globe.scene().add(countriesFill, borders);

    globe.globeMaterial().color?.set(OCEAN);
    globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 2));
    globe.pointOfView({ lat: 25, lng: 0, altitude: fitAltitude(el.clientWidth, el.clientHeight) });

    const controls = globe.controls();
    controls.minDistance = globe.getGlobeRadius() * (1 + MIN_ALTITUDE);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    const stopRotation = () => (controls.autoRotate = false);
    controls.addEventListener('start', stopRotation);
    const cameraMoved = () => (labelsDirty.current = true);
    controls.addEventListener('change', cameraMoved);

    // Una etiqueta solo se muestra si cabe sin pisar otros pines ni otras etiquetas ya colocadas:
    // de lejos quedan solo los pines y al acercarse van apareciendo los nombres.
    // El tamaño de cada etiqueta se mide una sola vez: leerlo en cada pasada obligaba al navegador
    // a recalcular la página entera.
    const labelSizes = new WeakMap<HTMLElement, { width: number; height: number }>();
    const sizeOf = (label: HTMLElement) => {
      let size = labelSizes.get(label);
      if (!size?.width) {
        size = { width: label.offsetWidth, height: label.offsetHeight };
        labelSizes.set(label, size);
      }
      return size;
    };
    const layoutLabels = () => {
      if (!labelsDirty.current) return;
      labelsDirty.current = false;
      const visible = tripsRef.current.flatMap((trip) => {
        const pin = pins.current.get(trip.id);
        if (!pin) return [];
        const label = pin.lastElementChild as HTMLElement;
        if (pin.dataset.hidden) {
          label.classList.add('hidden');
          return [];
        }
        const tip = globe.getScreenCoords(trip.lat, trip.lng, PIN_ALTITUDE);
        const head: Rect = {
          left: tip.x - PIN_BOX.halfWidth,
          right: tip.x + PIN_BOX.halfWidth,
          top: tip.y - PIN_BOX.height,
          bottom: tip.y,
        };
        const { width, height } = sizeOf(label);
        const box: Rect = {
          left: tip.x - width / 2,
          right: tip.x + width / 2,
          top: tip.y + LABEL_GAP,
          bottom: tip.y + LABEL_GAP + height,
        };
        return [{ label, head, box }];
      });

      const placed: Rect[] = [];
      for (const item of visible) {
        const fits =
          !visible.some((other) => other !== item && overlaps(other.head, item.box)) &&
          !placed.some((box) => overlaps(box, item.box));
        item.label.classList.toggle('hidden', !fits);
        if (fits) placed.push(item.box);
      }
    };
    const labelTimer = window.setInterval(layoutLabels, LABEL_LAYOUT_INTERVAL);

    const resizeObserver = new ResizeObserver(() => {
      globe.width(el.clientWidth).height(el.clientHeight);
      labelsDirty.current = true;
    });
    resizeObserver.observe(el);

    return () => {
      window.clearInterval(labelTimer);
      resizeObserver.disconnect();
      controls.removeEventListener('start', stopRotation);
      controls.removeEventListener('change', cameraMoved);
      el.removeEventListener('pointerdown', onPointerDown, true);
      el.removeEventListener('pointerup', onPointerUp, true);
      el.removeEventListener('pointercancel', onPointerUp, true);
      dispose(countriesFill);
      dispose(borders);
      if (areaMesh.current) dispose(areaMesh.current);
      countryMesh.current = areaMesh.current = null;
      globe._destructor?.();
      el.innerHTML = '';
    };
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    let cancelled = false;

    tripsRef.current = trips;
    const ids = new Set(trips.map((t) => t.id));
    for (const id of pins.current.keys()) if (!ids.has(id)) pins.current.delete(id);
    globe.htmlElementsData(trips);
    labelsDirty.current = true;

    // Países visitados sin provincia concreta: se colorea el país entero
    const countryFill = new Map(
      trips.filter((t) => t.countryId && !t.provinceId && !t.shape).map((t) => [t.countryId!, t.color]),
    );
    recolor(
      countryMesh.current!,
      countryKeys.map((key) => countryFill.get(key) ?? LAND),
    );

    Promise.all(
      trips.map(async (t): Promise<ColoredShape | undefined> => {
        if (t.shape) return { geometry: t.shape, color: t.color };
        if (!t.adminCode || !t.provinceId) return undefined;
        const province = (await loadProvinces(t.adminCode)).find((p) => p.id === t.provinceId);
        return province && { geometry: province.geometry, color: t.color };
      }),
    ).then((areas) => {
      if (cancelled) return;
      if (areaMesh.current) dispose(areaMesh.current);
      areaMesh.current = fillMesh(
        areas.filter((s): s is ColoredShape => !!s),
        AREA_ALTITUDE,
      );
      globeRef.current.scene().add(areaMesh.current);
    });

    return () => {
      cancelled = true;
    };
  }, [trips]);

  useEffect(() => {
    if (!focus) return;
    const globe = globeRef.current;
    globe.controls().autoRotate = false;
    globe.pointOfView({ lat: focus.lat, lng: focus.lng, altitude: focus.altitude }, 900);
  }, [focus]);

  return <div ref={container} className="globe" />;
}
