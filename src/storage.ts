import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { PIN_COLORS, type Photo, type Trip } from './types';

// Todo se guarda en el almacenamiento privado de la app (Directory.Data).
// En el navegador, el plugin Filesystem usa IndexedDB, así que el mismo código sirve para desarrollo.
const DIR = Directory.Data;
const TRIPS_FILE = 'trips.json';
const PHOTOS_DIR = 'photos';

// Las fotos se redimensionan al importarlas para no llenar el móvil:
// una foto de 12 MP (~4 MB) queda en unos 300-500 KB.
const PHOTO_MAX_SIDE = 1920;
const PHOTO_QUALITY = 0.82;
const THUMB_MAX_SIDE = 360;
const THUMB_QUALITY = 0.7;

export function newId(): string {
  // crypto.randomUUID no existe en http://<ip>:5173 (contexto no seguro)
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export async function loadTrips(): Promise<Trip[]> {
  try {
    const res = await Filesystem.readFile({ path: TRIPS_FILE, directory: DIR, encoding: Encoding.UTF8 });
    const trips: Trip[] = JSON.parse(res.data as string);
    // Los viajes guardados antes de que existiera el color no lo traen
    return trips.map((t) => ({ ...t, color: t.color ?? PIN_COLORS[0] }));
  } catch {
    return [];
  }
}

export async function saveTrips(trips: Trip[]): Promise<void> {
  await Filesystem.writeFile({
    path: TRIPS_FILE,
    directory: DIR,
    encoding: Encoding.UTF8,
    data: JSON.stringify(trips),
  });
}

async function resize(source: ImageBitmap, maxSide: number, quality: number) {
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const width = Math.round(source.width * scale);
  const height = Math.round(source.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(source, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo comprimir la imagen'))), 'image/jpeg', quality),
  );
  return { blob, width, height };
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function savePhoto(file: File): Promise<Photo> {
  const bitmap = await createImageBitmap(file);
  try {
    const full = await resize(bitmap, PHOTO_MAX_SIDE, PHOTO_QUALITY);
    const thumb = await resize(bitmap, THUMB_MAX_SIDE, THUMB_QUALITY);
    const id = newId();
    const photo: Photo = {
      id,
      file: `${PHOTOS_DIR}/${id}.jpg`,
      thumb: `${PHOTOS_DIR}/${id}_t.jpg`,
      width: full.width,
      height: full.height,
      size: full.blob.size + thumb.blob.size,
    };
    await Filesystem.writeFile({ path: photo.file, directory: DIR, data: await toBase64(full.blob), recursive: true });
    await Filesystem.writeFile({ path: photo.thumb, directory: DIR, data: await toBase64(thumb.blob), recursive: true });
    return photo;
  } finally {
    bitmap.close();
  }
}

export async function deletePhoto(photo: Photo): Promise<void> {
  for (const path of [photo.file, photo.thumb]) {
    urlCache.delete(path);
    await Filesystem.deleteFile({ path, directory: DIR }).catch(() => {});
  }
}

const urlCache = new Map<string, Promise<string>>();

/** URL utilizable en un <img> para un fichero guardado */
export function fileUrl(path: string): Promise<string> {
  let url = urlCache.get(path);
  if (!url) {
    url = Capacitor.isNativePlatform()
      ? Filesystem.getUri({ path, directory: DIR }).then((r) => Capacitor.convertFileSrc(r.uri))
      : Filesystem.readFile({ path, directory: DIR }).then((r) => `data:image/jpeg;base64,${r.data}`);
    urlCache.set(path, url);
  }
  return url;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
