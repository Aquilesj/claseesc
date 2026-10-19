/*
 * getflag — generador de la flag por sala del laboratorio.
 *
 * Se compila a /usr/local/bin/getflag con permisos 0711 (root): el usuario
 * www-data puede EJECUTARLO pero NO leer su código fuente ni el binario, así
 * que no puede extraer el "secreto" ni predecir la flag. La única forma de
 * obtenerla es ejecutar el programa, lo que obliga a conseguir RCE real
 * (no basta con leer un archivo por LFI).
 *
 * Uso:  getflag <sala>   ->   imprime  FLAG{lp_xxxxxxxx}
 */
#include <stdio.h>
#include <string.h>

int main(int argc, char **argv) {
    const char *secret = "l0g-p0is0n-lab::s3cr3t::2024";
    const char *room = (argc > 1) ? argv[1] : "general";

    char buf[600];
    snprintf(buf, sizeof(buf), "%s|%s", room, secret);

    /* djb2: suficiente para hacer la flag única por sala e impredecible */
    unsigned long h = 5381;
    for (const char *p = buf; *p; p++)
        h = ((h << 5) + h) + (unsigned char)*p;

    printf("FLAG{lp_%08lx}\n", h & 0xffffffffUL);
    return 0;
}
