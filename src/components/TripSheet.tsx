import { useState } from 'react';
import { formatBytes } from '../storage';
import type { Photo, Trip } from '../types';
import ColorPicker from './ColorPicker';
import PhotoPicker from './PhotoPicker';
import PhotoViewer from './PhotoViewer';
import Sheet from './Sheet';
import StoredImage from './StoredImage';

interface Props {
  trip: Trip;
  busy: string | null;
  onClose: () => void;
  onColor: (color: string) => void;
  onAddPhotos: (files: File[]) => void;
  onDeletePhoto: (photo: Photo) => void;
  onDeleteTrip: () => void;
}

export function formatDate(date: string): string {
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function TripSheet({ trip, busy, onClose, onColor, onAddPhotos, onDeletePhoto, onDeleteTrip }: Props) {
  const [viewing, setViewing] = useState<number | null>(null);
  const size = trip.photos.reduce((sum, p) => sum + p.size, 0);

  return (
    <>
      <Sheet title={trip.title} subtitle={[trip.province, trip.place, formatDate(trip.date)].filter(Boolean).join(' · ')} onClose={onClose}>
        {trip.photos.length === 0 ? (
          <p className="empty">Este viaje todavía no tiene fotos.</p>
        ) : (
          <div className="grid">
            {trip.photos.map((photo, i) => (
              <button key={photo.id} className="grid-item" onClick={() => setViewing(i)}>
                <StoredImage path={photo.thumb} />
              </button>
            ))}
          </div>
        )}

        <PhotoPicker className="button" disabled={!!busy} onPick={onAddPhotos}>
          {busy ?? 'Añadir fotos'}
        </PhotoPicker>

        <ColorPicker value={trip.color} onChange={onColor} />

        <footer className="sheet-footer">
          <span>
            {trip.photos.length} {trip.photos.length === 1 ? 'foto' : 'fotos'} · {formatBytes(size)}
          </span>
          <button
            className="link danger"
            disabled={!!busy}
            onClick={() => {
              if (confirm(`¿Eliminar "${trip.title}" y todas sus fotos? No se puede deshacer.`)) onDeleteTrip();
            }}
          >
            Eliminar viaje
          </button>
        </footer>
      </Sheet>

      {viewing !== null && trip.photos.length > 0 && (
        <PhotoViewer
          photos={trip.photos}
          index={Math.min(viewing, trip.photos.length - 1)}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
          onDelete={(photo) => {
            if (!confirm('¿Eliminar esta foto? No se puede deshacer.')) return;
            if (trip.photos.length === 1) setViewing(null);
            onDeletePhoto(photo);
          }}
        />
      )}
    </>
  );
}
