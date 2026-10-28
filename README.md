# Remember

Un recordatorio de dónde has viajado: un globo terráqueo 3D donde pones pines en los países que has
visitado y guardas las fotos de cada viaje. Todo se queda en el móvil; no hay servidor ni cuentas.

## Stack

- **React + TypeScript + Vite** para la interfaz.
- **globe.gl** (three.js) para el globo. El mapa va incluido en la app, así que funciona sin conexión.
- **Capacitor** para empaquetarla como app nativa y guardar ficheros en el almacenamiento privado de la app.
- **Docker** para todo: en el PC no hace falta instalar Node, Java ni el SDK de Android.

## Desarrollo

```bash
docker compose up web
```

Abre http://localhost:5173. Para probarla en el móvil, conéctalo a la misma wifi y abre
`http://<IP-del-PC>:5173` en su navegador.

En el navegador los datos se guardan en IndexedDB, con el mismo código que en el móvil.

## Generar el APK de Android

```bash
docker compose run --rm android
```

La primera vez descarga el SDK de Android y tarda varios minutos. El resultado es `Remember-debug.apk`
en la raíz del proyecto: cópialo al móvil e instálalo.

La carpeta `android/` se genera sola y no se sube al repositorio.

### Actualizar la app sin perder los datos

Android solo instala una versión nueva encima de la antigua (conservando viajes y fotos) si las dos
están firmadas con la misma clave. La clave se guarda en `docker/keystore/` (no se sube al repositorio):
**guarda una copia de esa carpeta**, porque si se pierde, la siguiente versión no se podrá instalar encima.

Si la clave ha cambiado (por ejemplo, el APK se generó antes de que existiera `docker/keystore/`),
el móvil dirá que la app no se puede instalar. Entonces, con el móvil conectado por USB y la depuración
USB activada:

```bash
sh scripts/copia-movil.sh guardar
```

Comprueba que dice cuántas fotos ha copiado, desinstala Remember del móvil, instala el APK nuevo, ábrelo
una vez y ciérralo, y después:

```bash
sh scripts/copia-movil.sh restaurar
```

## Mapa

- **Países**: contornos de `world-atlas` (escala 1:50 m), incluidos en la app.
- **Provincias** (`public/admin1/<PAÍS>.json`): provincias/estados de Natural Earth, simplificados. No se
  dibujan en el mapa; se usan para elegir la provincia al tocar un país y para colorear solo las visitadas.
  Cada país se carga únicamente cuando hace falta.
- **Buscador de lugares** (`src/search.ts`): busca pueblos, ciudades, islas… en OpenStreetMap (Nominatim)
  y colorea el contorno real del lugar. Es lo único que necesita internet, y solo al buscar: el contorno
  se guarda con el viaje. Nominatim es un servicio gratuito con
  [condiciones de uso](https://operations.osmfoundation.org/policies/nominatim/): máximo una búsqueda por
  segundo y sin autocompletar; por eso se busca al pulsar el botón y no mientras se escribe.

Las provincias (1,4 MB) ya están generadas. Para regenerarlas:

```bash
docker compose run --rm web sh -c "npm install && npm run map-data"
```

## Fotos y almacenamiento

Las fotos se copian al almacenamiento de la app, redimensionadas a 1920 px de lado mayor (JPEG),
más una miniatura. Una foto de 12 MP pasa de ~4 MB a unos 300-500 KB, así que 1000 fotos rondan
los 400 MB. En "Mis viajes" se ve cuánto ocupa todo. Los ajustes están al principio de
`src/storage.ts`.

Al ser una copia, borrar la foto de la galería no afecta a Remember. A cambio, desinstalar la app
borra los viajes y sus fotos.

## Si `npm install` falla dentro de Docker

Ver [docker/certs/README.md](docker/certs/README.md) (antivirus o proxy que inspecciona HTTPS).
