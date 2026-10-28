#!/bin/sh
# Copia de seguridad de los viajes y fotos de Remember desde un móvil Android, y restauración.
#
#   sh scripts/copia-movil.sh guardar     → descarga los datos del móvil a remember-copia.tar
#   sh scripts/copia-movil.sh restaurar   → los vuelve a subir al móvil
#
# Hace falta el móvil conectado por USB con la depuración USB activada, y adb (viene con Android Studio).
# Solo funciona con el APK de depuración (Remember-debug.apk), que permite a adb leer sus datos.
#
# Para qué sirve: Android solo deja instalar una versión nueva encima de la antigua si las dos están
# firmadas con la misma clave. Si la clave cambia, hay que desinstalar, y desinstalar borra los datos.
# Con esto se guardan antes y se restauran después.
set -e
# En Git Bash (Windows), que no convierta las rutas del móvil (/data/...) en rutas de Windows
export MSYS_NO_PATHCONV=1

APP=com.izan.remember
FILE=${2:-remember-copia.tar}
ADB=${ADB:-adb}
command -v "$ADB" > /dev/null || ADB="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"

# Capacitor guarda Directory.Data en la carpeta "files" de la app
case "$1" in
  guardar)
    "$ADB" exec-out run-as $APP tar -cf - files > "$FILE"
    # Comprueba que la copia se lee y que trae los viajes antes de dar nada por bueno
    tar -tf "$FILE" | grep -q '^files/trips.json$' || { echo "La copia no contiene trips.json: NO desinstales la app"; exit 1; }
    echo "Copia guardada en $FILE ($(tar -tf "$FILE" | grep -c '\.jpg$') fotos)"
    ;;
  restaurar)
    [ -f "$FILE" ] || { echo "No existe $FILE"; exit 1; }
    "$ADB" push "$FILE" /data/local/tmp/remember-copia.tar
    "$ADB" shell chmod 644 /data/local/tmp/remember-copia.tar
    "$ADB" shell am force-stop $APP
    "$ADB" shell run-as $APP tar -xf /data/local/tmp/remember-copia.tar
    "$ADB" shell rm /data/local/tmp/remember-copia.tar
    echo "Datos restaurados. Abre Remember en el móvil."
    ;;
  *)
    echo "Uso: sh scripts/copia-movil.sh guardar|restaurar [fichero]"
    exit 1
    ;;
esac
