# Docker + túnel Cloudflare en Codespaces

Paso a paso para levantar el lab de **Log Poisoning** (Node/Express) y exponerlo a Internet
con un túnel Cloudflare gratuito (sin AWS). Útil si creaste el Codespace sin el
`.devcontainer` (que ya instala cloudflared).

```bash
# 1. Instalar el plugin de Docker Compose (si falta)
sudo apt-get update && sudo apt-get install -y docker-compose-plugin

# 2. Instalar cloudflared desde el repositorio oficial de Cloudflare
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install -y cloudflared

# 3. Levantar la intranet vulnerable (Node/Express) en el puerto 80
docker compose up -d --build

# 4. Lanzar el túnel público gratuito al puerto 80
cloudflared tunnel --url http://localhost:80
```

El paso 4 imprime una URL `https://<algo>.trycloudflare.com` que apunta a tu lab. Es un túnel
**temporal**: al cortar el proceso (Ctrl-C) la URL deja de existir. Compártela con la clase
solo mientras dure la sesión.

> **Nota:** las URLs de Cloudflare correctas son `https://pkg.cloudflare.com/...` (no
> `https://cloudflare.com`). Alternativa sin repositorio apt: descargar el `.deb` directo con
> `wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i cloudflared-linux-amd64.deb`
> (es lo que hace el `.devcontainer`).

## Si NO ves los cambios en el Codespace
El código viejo (XSS) fue reemplazado por este lab. Fuerza la actualización y reconstruye:
```bash
git fetch origin
git checkout claude/fervent-edison-1w9rqh
git reset --hard origin/claude/fervent-edison-1w9rqh
git log --oneline -1

docker compose down
docker compose up -d --build
```
Recarga el navegador con **Ctrl+Shift+R**. Debes ver el **login de la intranet ACME**.
