import { useEffect, useRef } from 'react';
import Globe from 'globe.gl';
import { adminCode, countries, countryKey, countryName, findCountry, type CountryFeature } from '../countries';
import type { Geometry } from '../geo';
import { loadProvinces } from '../provinces';
import type { PickedPlace, Trip } from '../types';

const OCEAN = '#0d1b33';
const LAND = '#26375a';
const BORDER = '#0a1222';
const TRANSPARENT = 'rgba(0, 0, 0, 0)';
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
const LABEL_GAP = 4;

/** Altura de cámara a la que un lugar de `span` grados ocupa más o menos un tercio del ancho de pantalla */
export function altitudeForSpan(span: number): number {
  return Math.min(MAX_ALTITUDE, Math.max(MIN_ALTITUDE, span * 0.125));
}

// El globo dibuja los países y, encima, las zonas visitadas (provincias o lugares del buscador)
type Shape =
  | { kind: 'country'; geometry: Geometry; key: string }
  | { kind: 'area'; geometry: Geometry; color: string };

const countryShapes: Shape[] = countries.map((f) => ({ kind: 'country', geometry: f.geometry, key: countryKey(f) }));

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
  // Países visitados sin provincia concreta: se colorea el país entero
  const countryFill = useRef(new Map<string, string>());
  const callbacks = useRef({ onPickPlace, onPickTrip });
  callbacks.current = { onPickPlace, onPickTrip };

  useEffect(() => {
    const el = container.current!;
    const globe: any = new (Globe as any)(el);
    globeRef.current = globe;

    const pick = ({ lat, lng }: { lat: number; lng: number }) => {
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
      .polygonsData(countryShapes)
      .polygonCapColor((s: Shape) => (s.kind === 'area' ? s.color : (countryFill.current.get(s.key) ?? LAND)))
      .polygonSideColor(() => TRANSPARENT)
      .polygonStrokeColor((s: Shape) => (s.kind === 'country' ? BORDER : false))
      .polygonAltitude((s: Shape) => (s.kind === 'area' ? AREA_ALTITUDE : COUNTRY_ALTITUDE))
      .polygonsTransitionDuration(0)
      .onPolygonClick((_s: Shape, _ev: unknown, coords: { lat: number; lng: number }) => pick(coords))
      .onGlobeClick(pick)
      .htmlLat('lat')
      .htmlLng('lng')
      .htmlAltitude(PIN_ALTITUDE)
      .htmlElement((trip: Trip) => {
        const pin = document.createElement('button');
        pin.className = 'pin';
        pin.style.setProperty('--pin-color', trip.color);
        pin.setAttribute('aria-label', trip.title);
        pin.innerHTML = '<span class="pin-head"></span><span class="pin-label hidden"></span>';
        pin.lastElementChild!.textContent = trip.province ?? trip.place;
        pin.onclick = (ev) => {
          ev.stopPropagation();
          callbacks.current.onPickTrip(trip.id);
        };
        pins.current.set(trip.id, pin);
        return pin;
      });

    // Oculta los pines que quedan en la cara oculta del globo
    globe.htmlElementVisibilityModifier?.((pin: HTMLElement, isVisible: boolean) => {
      pin.style.opacity = isVisible ? '1' : '0';
      pin.style.pointerEvents = isVisible ? 'auto' : 'none';
      pin.dataset.hidden = isVisible ? '' : '1';
    });

    globe.globeMaterial().color?.set(OCEAN);
    globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 2));
    globe.pointOfView({ lat: 25, lng: 0, altitude: fitAltitude(el.clientWidth, el.clientHeight) });

    const controls = globe.controls();
    controls.minDistance = globe.getGlobeRadius() * (1 + MIN_ALTITUDE);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    const stopRotation = () => (controls.autoRotate = false);
    controls.addEventListener('start', stopRotation);

    // Una etiqueta solo se muestra si cabe sin pisar otros pines ni otras etiquetas ya colocadas:
    // de lejos quedan solo los pines y al acercarse van apareciendo los nombres.
    const layoutLabels = () => {
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
        const box: Rect = {
          left: tip.x - label.offsetWidth / 2,
          right: tip.x + label.offsetWidth / 2,
          top: tip.y + LABEL_GAP,
          bottom: tip.y + LABEL_GAP + label.offsetHeight,
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

    const resizeObserver = new ResizeObserver(() => globe.width(el.clientWidth).height(el.clientHeight));
    resizeObserver.observe(el);

    return () => {
      window.clearInterval(labelTimer);
      resizeObserver.disconnect();
      controls.removeEventListener('start', stopRotation);
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

    countryFill.current = new Map(
      trips.filter((t) => t.countryId && !t.provinceId && !t.shape).map((t) => [t.countryId!, t.color]),
    );

    Promise.all(
      trips.map(async (t): Promise<Shape | undefined> => {
        if (t.shape) return { kind: 'area', geometry: t.shape, color: t.color };
        if (!t.adminCode || !t.provinceId) return undefined;
        const province = (await loadProvinces(t.adminCode)).find((p) => p.id === t.provinceId);
        return province && { kind: 'area', geometry: province.geometry, color: t.color };
      }),
    ).then((areas) => {
      if (cancelled) return;
      // Reasignar los datos también repinta los países (countryFill)
      globe.polygonsData([...countryShapes, ...areas.filter((s) => s)]);
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
