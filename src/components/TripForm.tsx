import { useEffect, useState } from 'react';
import { findProvince, loadProvinces, type Province } from '../provinces';
import { PIN_COLORS, type PickedPlace } from '../types';
import ColorPicker from './ColorPicker';
import PhotoPicker from './PhotoPicker';
import Sheet from './Sheet';

export interface TripFormData {
  title: string;
  place: string;
  province?: Province;
  /** La provincia elegida es la que se tocó en el mapa: el pin se queda donde se tocó */
  provinceTapped: boolean;
  date: string;
  color: string;
  files: File[];
}

interface Props {
  place: PickedPlace;
  /** Color propuesto para el pin */
  defaultColor?: string;
  /** Texto de progreso mientras se guardan las fotos */
  busy: string | null;
  onCancel: () => void;
  onSave: (data: TripFormData) => void;
}

export default function TripForm({ place, defaultColor = PIN_COLORS[0], busy, onCancel, onSave }: Props) {
  const [placeName, setPlaceName] = useState(place.place);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [tappedId, setTappedId] = useState<string>();
  const [provinceId, setProvinceId] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [color, setColor] = useState(defaultColor);
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!place.adminCode || place.area) return;
    let cancelled = false;
    loadProvinces(place.adminCode).then((loaded) => {
      if (cancelled) return;
      const tapped = findProvince(loaded, place.lat, place.lng);
      setProvinces(loaded);
      setTappedId(tapped?.id);
      setProvinceId(tapped?.id ?? '');
    });
    return () => {
      cancelled = true;
    };
  }, [place]);

  const province = provinces.find((p) => p.id === provinceId);
  const zoneName = place.area?.name ?? province?.name;
  const canSave = !busy && placeName.trim() !== '';

  return (
    <Sheet title="Nuevo viaje" subtitle={[...new Set([place.area?.name, place.place])].filter(Boolean).join(' · ') || 'Pon nombre a este lugar'} onClose={busy ? () => {} : onCancel}>
      <form
        className="form"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!canSave) return;
          const name = placeName.trim();
          onSave({
            title: title.trim() || zoneName || name,
            place: name,
            province,
            provinceTapped: !!province && province.id === tappedId,
            date,
            color,
            files,
          });
        }}
      >
        {place.area ? null : place.countryId ? (
          provinces.length > 0 && (
            <label>
              Provincia o región
              <select value={provinceId} onChange={(ev) => setProvinceId(ev.target.value)}>
                <option value="">Todo el país</option>
                {provinces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )
        ) : (
          <label>
            Lugar
            <input value={placeName} onChange={(ev) => setPlaceName(ev.target.value)} placeholder="Isla, ciudad…" />
          </label>
        )}
        <label>
          Título
          <input value={title} onChange={(ev) => setTitle(ev.target.value)} placeholder={zoneName || placeName} />
        </label>
        <label>
          Fecha
          <input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} />
        </label>
        <div className="field">
          Color del pin
          <ColorPicker value={color} onChange={setColor} />
        </div>

        <PhotoPicker className="button secondary" disabled={!!busy} onPick={(picked) => setFiles([...files, ...picked])}>
          {files.length ? `${files.length} fotos seleccionadas · añadir más` : 'Añadir fotos'}
        </PhotoPicker>

        <button className="button" disabled={!canSave}>
          {busy ?? 'Guardar viaje'}
        </button>
      </form>
    </Sheet>
  );
}
