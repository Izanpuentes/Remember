import { useRef } from 'react';
import type { Photo } from '../types';
import StoredImage from './StoredImage';

interface Props {
  photos: Photo[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  onDelete: (photo: Photo) => void;
}

const SWIPE_DISTANCE = 50;

/** Visor a pantalla completa; se pasa de foto deslizando o tocando los lados */
export default function PhotoViewer({ photos, index, onIndex, onClose, onDelete }: Props) {
  const touchStart = useRef<number | null>(null);
  const photo = photos[index];

  const go = (delta: number) => {
    const next = index + delta;
    if (next >= 0 && next < photos.length) onIndex(next);
  };

  return (
    <div
      className="viewer"
      onTouchStart={(ev) => (touchStart.current = ev.touches[0].clientX)}
      onTouchEnd={(ev) => {
        if (touchStart.current === null) return;
        const dx = ev.changedTouches[0].clientX - touchStart.current;
        touchStart.current = null;
        if (Math.abs(dx) > SWIPE_DISTANCE) go(dx < 0 ? 1 : -1);
      }}
    >
      <StoredImage key={photo.id} path={photo.file} className="viewer-image" />

      <button className="viewer-side left" onClick={() => go(-1)} aria-label="Anterior" />
      <button className="viewer-side right" onClick={() => go(1)} aria-label="Siguiente" />

      <div className="viewer-bar">
        <button className="icon-button" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
        <span>
          {index + 1} / {photos.length}
        </span>
        <button className="link danger" onClick={() => onDelete(photo)}>
          Eliminar
        </button>
      </div>
    </div>
  );
}
