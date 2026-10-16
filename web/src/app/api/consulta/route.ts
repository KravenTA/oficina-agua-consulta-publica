import { verificarCaptcha } from '@/lib/captcha-servidor';
import { consultarEstadoCuenta } from '@/lib/cliente-api';
import { configServidor } from '@/lib/config';
import { resolverIp } from '@/lib/ip-cliente';
import { errorJson, exitoJson } from '@/lib/respuestas';
import { validarSerie } from '@/lib/validacion';

const MAX_CUERPO = 10_000; // un token de captcha pesa unos 2 KB
const MAX_TOKEN = 4096;

// Errores del ApiRest que se reenvian tal cual al navegador (mismo formato { codigo, mensaje, fecha }).
const ESTADOS_REENVIADOS = new Set([400, 404, 429, 500, 503]);

/**
 * BFF de la consulta publica. Orden de las comprobaciones:
 *   1. el pedido y el codigo del contador son validos
 *   2. el captcha es valido (se verifica aqui, con la clave secreta)
 *   3. solo entonces se llama al ApiRest
 * Si el captcha falla, el ApiRest no se llama. El navegador nunca conoce la URL del ApiRest.
 */
export async function POST(request: Request) {
  // --- 1. Leer y validar el pedido ---
  let entrada: { numeroSerie?: unknown; captchaToken?: unknown };
  try {
    const texto = await request.text();
    if (texto.length > MAX_CUERPO) {
      return errorJson(400, 'SOLICITUD_INVALIDA', 'La solicitud es demasiado grande.');
    }
    entrada = JSON.parse(texto);
  } catch {
    return errorJson(400, 'SOLICITUD_INVALIDA', 'La solicitud no es válida.');
  }
  if (typeof entrada !== 'object' || entrada === null || typeof entrada.numeroSerie !== 'string') {
    return errorJson(400, 'SOLICITUD_INVALIDA', 'La solicitud no es válida.');
  }

  // El navegador ya valida, pero el servidor nunca confia en eso.
  const serie = validarSerie(entrada.numeroSerie);
  if (serie.error) {
    return errorJson(400, 'SERIE_INVALIDA', serie.error);
  }

  const token = entrada.captchaToken;
  if (typeof token !== 'string' || token.trim() === '' || token.length > MAX_TOKEN) {
    return errorJson(403, 'CAPTCHA_INVALIDO', 'Completa la verificación de seguridad para continuar.');
  }

  // --- 2. Verificar el captcha en el servidor ---
  const config = configServidor();
  const ip = resolverIp(request.headers);

  const captcha = await verificarCaptcha({
    provider: config.provider,
    secreto: config.secreto,
    token: token.trim(),
    ip,
    urlVerificacion: config.urlVerificacion,
  });
  if (!captcha.ok) {
    switch (captcha.motivo) {
      case 'no_configurado':
        console.error('[consulta] El captcha no esta bien configurado (revisar CAPTCHA_SECRET_KEY).');
        return errorJson(500, 'ERROR_CONFIGURACION', 'El servicio no está configurado correctamente.');
      case 'no_disponible':
        console.error('[consulta] No se pudo contactar al servicio de verificacion del captcha.');
        return errorJson(503, 'CAPTCHA_NO_DISPONIBLE', 'No se pudo verificar el captcha. Intenta de nuevo en unos segundos.');
      default:
        // Sin llamar al ApiRest.
        return errorJson(403, 'CAPTCHA_INVALIDO', 'La verificación de seguridad no es válida. Resuélvela de nuevo.');
    }
  }

  // --- 3. Llamar al ApiRest ---
  const respuesta = await consultarEstadoCuenta({ baseUrl: config.apiUrl, numeroSerie: serie.valor, ip });
  if (respuesta === null) {
    console.error('[consulta] El ApiRest no respondio.');
    return errorJson(503, 'SERVICIO_NO_DISPONIBLE', 'El servicio de consulta no está disponible por el momento.');
  }

  if (respuesta.status === 200 && respuesta.cuerpo !== null) {
    return exitoJson(respuesta.cuerpo);
  }

  if (ESTADOS_REENVIADOS.has(respuesta.status) && esErrorDeApi(respuesta.cuerpo)) {
    const extra = respuesta.status === 429 && respuesta.retryAfter ? { 'Retry-After': respuesta.retryAfter } : undefined;
    return errorJson(respuesta.status, respuesta.cuerpo.codigo, respuesta.cuerpo.mensaje, extra);
  }

  console.error(`[consulta] Respuesta inesperada del ApiRest: ${respuesta.status}`);
  return errorJson(503, 'SERVICIO_NO_DISPONIBLE', 'El servicio de consulta no está disponible por el momento.');
}

function esErrorDeApi(cuerpo: unknown): cuerpo is { codigo: string; mensaje: string } {
  const c = cuerpo as { codigo?: unknown; mensaje?: unknown } | null;
  return typeof c?.codigo === 'string' && typeof c?.mensaje === 'string';
}
