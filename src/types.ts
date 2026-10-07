import type { Geometry } from './geo';

export interface Photo {
  id: string;
  /** Ruta de la foto (redimensionada) dentro del almacenamiento de la app */
  file: string;
  /** Ruta de la miniatura */
  thumb: string;
  width: number;
  height: number;
  /** Bytes ocupados en el dispositivo (foto + miniatura) */
  size: number;
}

export interface Trip {
  id: string;
  title: string;
  /** Clave del país en el mapa; vacío si el pin está fuera de un país dibujado */
  countryId?: string;
  /** Código del fichero de provincias del país */
  adminCode?: string;
  provinceId?: string;
  /** Nombre de la zona visitada dentro del país: provincia, o el lugar encontrado con el buscador */
  province?: string;
  /** Contorno del lugar encontrado con el buscador; se guarda para no depender de internet */
  shape?: Geometry;
  /** Nombre del país, o del lugar si el pin no está en un país */
  place: string;
  lat: number;
  lng: number;
  /** yyyy-mm-dd */
  date: string;
  /** Color del pin y de la provincia en el mapa (#rrggbb) */
  color: string;
  photos: Photo[];
  createdAt: number;
}

export interface PickedPlace {
  lat: number;
  lng: number;
  countryId?: string;
  adminCode?: string;
  place: string;
  /** Lugar concreto elegido con el buscador */
  area?: { name: string; geometry: Geometry };
}

export const PIN_COLORS = ['#ff5d5d', '#ff9f43', '#f5d547', '#4cd97b', '#3ec6e0', '#5b8cff', '#b07cff', '#ff6fb5'];
