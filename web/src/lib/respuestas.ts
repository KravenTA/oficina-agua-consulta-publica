export type CodigoError =
  | 'SOLICITUD_INVALIDA'
  | 'SERIE_INVALIDA'
  | 'CAPTCHA_INVALIDO'
  | 'CAPTCHA_NO_DISPONIBLE'
  | 'SERVICIO_NO_DISPONIBLE'
  | 'ERROR_CONFIGURACION'
  | 'ERROR_INTERNO';

const CABECERAS = { 'Cache-Control': 'no-store' };

/** Respuesta de error con el mismo formato que el ApiRest: { codigo, mensaje, fecha }. */
export function errorJson(status: number, codigo: CodigoError | string, mensaje: string, extra?: HeadersInit): Response {
  return Response.json(
    { codigo, mensaje, fecha: new Date().toISOString() },
    { status, headers: { ...CABECERAS, ...(extra as Record<string, string>) } },
  );
}

export function exitoJson(cuerpo: unknown): Response {
  return Response.json(cuerpo, { status: 200, headers: CABECERAS });
}
