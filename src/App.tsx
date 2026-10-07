import { useEffect, useRef, useState } from 'react';
import GlobeView, { altitudeForSpan } from './components/GlobeView';
import SearchPanel from './components/SearchPanel';
import TripForm, { type TripFormData } from './components/TripForm';
import TripList from './components/TripList';
import TripSheet from './components/TripSheet';
import { countryKey, findCountry } from './countries';
import { spanOf } from './geo';
import type { SearchResult } from './search';
import { deletePhoto, loadTrips, newId, savePhoto, saveTrips } from './storage';
import { PIN_COLORS, type Photo, type PickedPlace, type Trip } from './types';

// Altura de cámara al volar a un viaje marcado por provincia o país
const REGION_ALTITUDE = 0.6;

type View =
  | { type: 'globe' }
  | { type: 'new'; place: PickedPlace }
  | { type: 'trip'; id: string }
  | { type: 'list' }
  | { type: 'search' };

export default function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [view, setView] = useState<View>({ type: 'globe' });
  const [focus, setFocus] = useState<{ lat: number; lng: number; altitude: number; nonce: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Las importaciones de fotos son asíncronas: siempre se parte de la última versión de los viajes
  const latest = useRef(trips);

  useEffect(() => {
    loadTrips().then((loaded) => {
      latest.current = loaded;
      setTrips(loaded);
    });
  }, []);

  const commit = async (next: Trip[]) => {
    latest.current = next;
    setTrips(next);
    await saveTrips(next);
  };

  const importPhotos = async (files: File[]): Promise<Photo[]> => {
    const photos: Photo[] = [];
    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      setBusy(`Guardando foto ${i + 1} de ${files.length}…`);
      try {
        photos.push(await savePhoto(files[i]));
      } catch {
        failed++;
      }
    }
    if (failed) alert(`No se han podido guardar ${failed} de ${files.length} fotos.`);
    return photos;
  };

  const flyTo = (trip: Trip) =>
    setFocus({
      lat: trip.lat,
      lng: trip.lng,
      altitude: trip.shape ? altitudeForSpan(spanOf(trip.shape)) : REGION_ALTITUDE,
      nonce: Date.now(),
    });

  const pickSearchResult = (result: SearchResult) => {
    const country = findCountry(result.lat, result.lng);
    setFocus({ lat: result.lat, lng: result.lng, altitude: altitudeForSpan(result.span), nonce: Date.now() });
    setView({
      type: 'new',
      place: {
        lat: result.lat,
        lng: result.lng,
        countryId: country && countryKey(country),
        place: result.country,
        area: { name: result.name, geometry: result.geometry },
      },
    });
  };

  const createTrip = async (place: PickedPlace, data: TripFormData) => {
    try {
      const photos = await importPhotos(data.files);
      const trip: Trip = {
        id: newId(),
        title: data.title,
        countryId: place.countryId,
        adminCode: place.adminCode,
        provinceId: data.province?.id,
        province: place.area?.name ?? data.province?.name,
        shape: place.area?.geometry,
        place: data.place,
        // Si se eligió otra provincia distinta de la que se tocó, el pin va a esa provincia
        lat: data.province && !data.provinceTapped ? data.province.lat : place.lat,
        lng: data.province && !data.provinceTapped ? data.province.lng : place.lng,
        date: data.date,
        color: data.color,
        photos,
        createdAt: Date.now(),
      };
      await commit([...latest.current, trip]);
      setView({ type: 'trip', id: trip.id });
      flyTo(trip);
    } finally {
      setBusy(null);
    }
  };

  const addPhotos = async (tripId: string, files: File[]) => {
    try {
      const photos = await importPhotos(files);
      await commit(latest.current.map((t) => (t.id === tripId ? { ...t, photos: [...t.photos, ...photos] } : t)));
    } finally {
      setBusy(null);
    }
  };

  const setColor = (tripId: string, color: string) =>
    commit(latest.current.map((t) => (t.id === tripId ? { ...t, color } : t)));

  const removePhoto = async (tripId: string, photo: Photo) => {
    await commit(
      latest.current.map((t) => (t.id === tripId ? { ...t, photos: t.photos.filter((p) => p.id !== photo.id) } : t)),
    );
    await deletePhoto(photo);
  };

  const removeTrip = async (trip: Trip) => {
    setView({ type: 'globe' });
    await commit(latest.current.filter((t) => t.id !== trip.id));
    for (const photo of trip.photos) await deletePhoto(photo);
  };

  const openTrip = view.type === 'trip' ? trips.find((t) => t.id === view.id) : undefined;
  const visitedCountries = new Set(trips.map((t) => t.provinceId ?? (t.shape && t.province) ?? t.countryId ?? t.place)).size;

  return (
    <>
      <GlobeView
        trips={trips}
        focus={focus}
        onPickPlace={(place) => setView({ type: 'new', place })}
        onPickTrip={(id) => setView({ type: 'trip', id })}
      />

      <header className="topbar">
        <h1>Remember</h1>
        <p>
          {trips.length === 0
            ? 'Toca un país o busca un lugar para añadir un viaje'
            : `${visitedCountries} ${visitedCountries === 1 ? 'lugar' : 'lugares'} · ${trips.length} ${trips.length === 1 ? 'viaje' : 'viajes'}`}
        </p>
        <button className="search-button" onClick={() => setView({ type: 'search' })}>
          Buscar un lugar
        </button>
      </header>

      <button className="fab" onClick={() => setView({ type: 'list' })}>
        Mis viajes
      </button>

      {view.type === 'new' && (
        <TripForm
          place={view.place}
          defaultColor={PIN_COLORS[trips.length % PIN_COLORS.length]}
          busy={busy}
          onCancel={() => setView({ type: 'globe' })}
          onSave={(data) => createTrip(view.place, data)}
        />
      )}

      {openTrip && (
        <TripSheet
          trip={openTrip}
          busy={busy}
          onClose={() => setView({ type: 'globe' })}
          onColor={(color) => setColor(openTrip.id, color)}
          onAddPhotos={(files) => addPhotos(openTrip.id, files)}
          onDeletePhoto={(photo) => removePhoto(openTrip.id, photo)}
          onDeleteTrip={() => removeTrip(openTrip)}
        />
      )}

      {view.type === 'search' && <SearchPanel onClose={() => setView({ type: 'globe' })} onPick={pickSearchResult} />}

      {view.type === 'list' && (
        <TripList
          trips={trips}
          onClose={() => setView({ type: 'globe' })}
          onPick={(trip) => {
            setView({ type: 'trip', id: trip.id });
            flyTo(trip);
          }}
        />
      )}
    </>
  );
}
