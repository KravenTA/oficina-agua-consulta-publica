/**
 * Marcador de posicion. La validacion del captcha en servidor y la llamada al ApiRest
 * se implementan en la HU-26; hasta entonces este endpoint responde 501.
 */
export async function POST() {
  return Response.json(
    { codigo: 'NO_IMPLEMENTADO', mensaje: 'La consulta todavía no está disponible.' },
    { status: 501 },
  );
}
