FROM node:20-bookworm

# Compila el generador de flags: EJECUTABLE pero NO legible (0711, root).
# El proceso corre como usuario 'node', que puede ejecutarlo vía RCE pero no
# leer su secreto ni predecir la flag -> obliga a conseguir ejecución de código.
# Además, se le da a Node la capacidad de bindear puertos privilegiados para
# poder escuchar en el 80 sin ser root (mínimo privilegio).
COPY getflag.c /tmp/getflag.c
RUN apt-get update \
 && apt-get install -y --no-install-recommends gcc libc6-dev libcap2-bin \
 && gcc -O2 -o /usr/local/bin/getflag /tmp/getflag.c \
 && chown root:root /usr/local/bin/getflag \
 && chmod 0711 /usr/local/bin/getflag \
 && rm -f /tmp/getflag.c \
 && setcap 'cap_net_bind_service=+ep' "$(readlink -f "$(command -v node)")" \
 && apt-get purge -y --auto-remove gcc libc6-dev libcap2-bin \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js ./
COPY .env ./
COPY public ./public
COPY pages ./pages

# Directorios escribibles por el usuario 'node' (log de salas + resueltos).
RUN mkdir -p /var/log/lab /var/www/solved \
 && chown -R node:node /var/log/lab /var/www/solved

# Escucha en el 80 dentro del contenedor (gracias a cap_net_bind_service),
# sin ser root.
ENV PORT=80
USER node
EXPOSE 80
CMD ["node", "server.js"]
