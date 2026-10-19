# --- Etapa 1: compilar el front React ---
FROM node:20-bookworm AS build
WORKDIR /app
COPY package*.json ./
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm install
COPY . .
RUN npm run build

# --- Etapa 2: runtime (backend + bot + Chromium) ---
FROM node:20-bookworm
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN apt-get update \
  && apt-get install -y chromium --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js bot.js ./
COPY --from=build /app/dist ./dist
RUN mkdir -p data logs
EXPOSE 80
# Arranca backend y bot admin juntos.
CMD ["sh", "-c", "node server.js & node bot.js & wait"]
