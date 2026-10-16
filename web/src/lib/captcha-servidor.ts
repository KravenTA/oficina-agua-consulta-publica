import type { CaptchaProvider } from '@/components/Captcha';

export type ResultadoCaptcha =
  | { ok: true }
  | { ok: false; motivo: 'invalido' | 'no_configurado' | 'no_disponible' };

type Opciones = {
  provider: CaptchaProvider;
  /** Clave secreta del captcha. */
  secreto: string;
  /** Token que resolvio el usuario en el navegador. */
  token: string;
  ip?: string | null;
  urlVerificacion?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
};

const URL_VERIFICACION: Record<CaptchaProvider, string> = {
  recaptcha: 'https://www.google.com/recaptcha/api/siteverify',
  hcaptcha: 'https://api.hcaptcha.com/siteverify',
};

// Si el proveedor dice que la CLAVE esta mal, el problema es de configuracion, no del usuario.
const ERRORES_DE_CONFIGURACION = new Set([
  'missing-input-secret',
  'invalid-input-secret',
  'sitekey-secret-mismatch',
]);

/**
 * Verifica el token con el proveedor usando la clave secreta. Esto ocurre SIEMPRE en el
 * servidor: el navegador solo aporta el token, nunca decide si es valido.
 */
export async function verificarCaptcha(opciones: Opciones): Promise<ResultadoCaptcha> {
  const { provider, secreto, token, ip, urlVerificacion, fetchFn = fetch, timeoutMs = 5000 } = opciones;

  if (!secreto) {
    return { ok: false, motivo: 'no_configurado' };
  }

  const cuerpo = new URLSearchParams({ secret: secreto, response: token });
  if (ip) {
    cuerpo.set('remoteip', ip);
  }

  let respuesta: Response;
  try {
    respuesta = await fetchFn(urlVerificacion ?? URL_VERIFICACION[provider], {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: cuerpo,
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { ok: false, motivo: 'no_disponible' };
  }
  if (!respuesta.ok) {
    return { ok: false, motivo: 'no_disponible' };
  }

  let datos: unknown;
  try {
    datos = await respuesta.json();
  } catch {
    return { ok: false, motivo: 'no_disponible' };
  }

  const resultado = datos as { success?: unknown; 'error-codes'?: unknown };
  if (resultado?.success === true) {
    return { ok: true };
  }
  const codigos = Array.isArray(resultado?.['error-codes']) ? (resultado['error-codes'] as unknown[]) : [];
  if (codigos.some((c) => typeof c === 'string' && ERRORES_DE_CONFIGURACION.has(c))) {
    return { ok: false, motivo: 'no_configurado' };
  }
  return { ok: false, motivo: 'invalido' };
}
