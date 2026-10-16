// Solo caracteres de una IPv4/IPv6: evita que basura en la cabecera llegue al ApiRest.
const IP_VALIDA = /^[0-9a-fA-F:.]{2,45}$/;

/**
 * IP del cliente que se envia al ApiRest para su rate limit por IP.
 *
 * Se usa la ULTIMA entrada de X-Forwarded-For (la agrega el proxy mas cercano; las anteriores
 * pudo escribirlas el propio cliente). En la imagen de Docker, ip-del-socket.cjs deja esa
 * cabecera con la IP real de la conexion, para que un cliente no pueda falsearla.
 */
export function resolverIp(cabeceras: Headers): string | null {
  const reenviada = cabeceras.get('x-forwarded-for');
  if (reenviada) {
    const partes = reenviada.split(',');
    const ultima = partes[partes.length - 1].trim();
    if (IP_VALIDA.test(ultima)) {
      return ultima;
    }
  }
  const real = cabeceras.get('x-real-ip')?.trim();
  if (real && IP_VALIDA.test(real)) {
    return real;
  }
  return null;
}
