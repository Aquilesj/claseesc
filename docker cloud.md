# Docker + túnel Cloudflare en Codespaces

Paso a paso manual para levantar el lab con Docker y exponerlo a Internet con un túnel
Cloudflare gratuito (sin AWS). Útil si creaste el Codespace sin el `.devcontainer` (que ya
instala Chromium y cloudflared automáticamente).

```bash
# 1. Instalar el plugin de Docker Compose en el Codespace
sudo apt-get update && sudo apt-get install -y docker-compose-plugin

# 2. Agregar el repositorio oficial de Cloudflare e instalar cloudflared
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install -y cloudflared

# 3. Levantar los contenedores (backend + bot admin) en segundo plano
docker compose up -d --build

# 4. Lanzar el túnel público gratuito al puerto 80
cloudflared tunnel --url http://localhost:80
```

El paso 4 imprime una URL `https://<algo>.trycloudflare.com` que apunta a tu lab. Es un túnel
**temporal**: al cortar el proceso (Ctrl-C) la URL deja de existir. Compártela con la clase
solo mientras dure la sesión.

> **Nota:** las URLs de Cloudflare correctas son `https://pkg.cloudflare.com/...` (no
> `https://cloudflare.com`, que devuelve la página web, no la llave ni el repo). Alternativa
> sin repositorio apt: descargar el `.deb` directo con
> `wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i cloudflared-linux-amd64.deb`
> (es lo que hace el `.devcontainer`).

## Si NO ves los cambios en el Codespace

Casi siempre es porque el checkout quedó en un commit viejo o Docker reusó una imagen
cacheada. Fuerza la actualización y reconstruye:

```bash
git fetch origin
git checkout claude/fervent-edison-1w9rqh
git reset --hard origin/claude/fervent-edison-1w9rqh
git log --oneline -1          # debe mostrar el commit mas reciente

docker compose down
docker compose up -d --build  # reconstruye el front con los cambios
```

Luego recarga el navegador con **Ctrl+Shift+R** (recarga forzada, sin caché). Debes ver la
pantalla de **login** (no "Sala: general").
