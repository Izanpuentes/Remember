import { formatBytes } from '../storage';
import type { Trip } from '../types';
import Sheet from './Sheet';
import StoredImage from './StoredImage';
import { formatDate } from './TripSheet';

interface Props {
  trips: Trip[];
  onClose: () => void;
  onPick: (trip: Trip) => void;
}

export default function TripList({ trips, onClose, onPick }: Props) {
  const photos = trips.reduce((sum, t) => sum + t.photos.length, 0);
  const size = trips.reduce((sum, t) => sum + t.photos.reduce((s, p) => s + p.size, 0), 0);
  const sorted = [...trips].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Sheet title="Mis viajes" subtitle={`${photos} fotos · ${formatBytes(size)} en este dispositivo`} onClose={onClose}>
      {sorted.length === 0 ? (
        <p className="empty">Toca un país en el globo para añadir tu primer viaje.</p>
      ) : (
        <ul className="list">
          {sorted.map((trip) => (
            <li key={trip.id}>
              <button className="list-item" onClick={() => onPick(trip)}>
                {trip.photos[0] ? (
                  <StoredImage path={trip.photos[0].thumb} className="list-thumb" />
                ) : (
                  <div className="list-thumb" />
                )}
                <span className="list-text">
                  <strong>{trip.title}</strong>
                  <small>{[trip.province, trip.place, formatDate(trip.date)].filter(Boolean).join(' · ')}</small>
                </span>
                <small>{trip.photos.length}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
