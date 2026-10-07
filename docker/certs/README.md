# Certificados raíz extra

Si un antivirus o proxy inspecciona el tráfico HTTPS del PC (Avast, Kaspersky, proxy de empresa…),
los contenedores no confían en su certificado y `npm install` falla con
`UNABLE_TO_VERIFY_LEAF_SIGNATURE`.

Solución: exportar aquí el certificado raíz (solo la parte pública, formato PEM, extensión `.crt`).
El servidor de desarrollo usa `host-ca.crt`; la imagen de Android importa todos los `.crt` de esta carpeta.

Los `.crt` son específicos de cada máquina y no se suben al repositorio.
