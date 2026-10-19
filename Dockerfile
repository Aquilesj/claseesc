FROM php:8.2-apache

# Compila el generador de flags y lo deja EJECUTABLE pero NO legible (0711,
# root): www-data puede correrlo vía RCE, pero no leer su secreto ni predecir
# la flag. Luego se quita el compilador.
COPY getflag.c /tmp/getflag.c
RUN apt-get update \
 && apt-get install -y --no-install-recommends gcc libc6-dev \
 && gcc -O2 -o /usr/local/bin/getflag /tmp/getflag.c \
 && chown root:root /usr/local/bin/getflag \
 && chmod 0711 /usr/local/bin/getflag \
 && rm -f /tmp/getflag.c \
 && apt-get purge -y --auto-remove gcc libc6-dev \
 && rm -rf /var/lib/apt/lists/*

# App vulnerable (deliberado) al docroot de Apache.
COPY src/ /var/www/html/

# Carpeta donde se marcan las salas resueltas y log de salas (escribibles por www-data).
RUN mkdir -p /var/www/solved /var/log/lab \
 && chown -R www-data:www-data /var/www/solved /var/log/lab

EXPOSE 80
# La imagen base ya arranca Apache en primer plano (apache2-foreground).
