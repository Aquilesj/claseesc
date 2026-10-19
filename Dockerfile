FROM node:20-bookworm

# Compila el generador de flags: EJECUTABLE pero NO legible (0711, root).
# El proceso corre como usuario 'node', que puede ejecutarlo vía RCE pero no
# leer su secreto ni predecir la flag -> obliga a conseguir ejecución de código.
COPY getflag.c /tmp/getflag.c
RUN apt-get update \
 && apt-get install -y --no-install-recommends gcc libc6-dev \
 && gcc -O2 -o /usr/local/bin/getflag /tmp/getflag.c \
 && chown root:root /usr/local/bin/getflag \
 && chmod 0711 /usr/local/bin/getflag \
 && rm -f /tmp/getflag.c \
 && apt-get purge -y --auto-remove gcc libc6-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js ./
COPY public ./public
COPY pages ./pages

# Directorios escribibles por el usuario 'node' (log de salas + resueltos).
RUN mkdir -p /var/log/lab /var/www/solved \
 && chown -R node:node /var/log/lab /var/www/solved

# El usuario 'node' no puede bindear el puerto 80 (privilegiado); escuchamos
# en 3000 y el compose publica 80->3000.
ENV PORT=3000
USER node
EXPOSE 3000
CMD ["node", "server.js"]
