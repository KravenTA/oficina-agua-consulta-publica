import type { CaptchaProvider } from '@/components/Captcha';

export type ConfigCaptcha = {
  provider: CaptchaProvider;
  /** Clave publica del captcha. Vacia si no esta configurada. */
  siteKey: string;
};

/**
 * Lee la configuracion del captcha EN EL SERVIDOR, en cada peticion. Asi la clave publica
 * viene del entorno del contenedor y no queda fija dentro de la imagen al compilar.
 * La clave SECRETA no se lee aqui: solo la usa la validacion en servidor (HU-26).
 */
export function configCaptcha(env: Record<string, string | undefined> = process.env): ConfigCaptcha {
  const provider: CaptchaProvider = env.CAPTCHA_PROVIDER?.toLowerCase() === 'hcaptcha' ? 'hcaptcha' : 'recaptcha';
  return { provider, siteKey: (env.CAPTCHA_SITE_KEY ?? '').trim() };
}

export type ConfigServidor = {
  provider: CaptchaProvider;
  /** Clave SECRETA del captcha. Solo existe en el servidor. */
  secreto: string;
  /** URL interna del ApiRest. El navegador nunca la ve. */
  apiUrl: string;
  /** Solo para pruebas: permite apuntar la verificacion a un servidor falso. */
  urlVerificacion?: string;
};

/** Configuracion que usa /api/consulta. Se lee en cada peticion. */
export function configServidor(env: Record<string, string | undefined> = process.env): ConfigServidor {
  const { provider } = configCaptcha(env);
  return {
    provider,
    secreto: (env.CAPTCHA_SECRET_KEY ?? '').trim(),
    apiUrl: (env.API_INTERNAL_URL ?? '').trim() || 'http://localhost:8081',
    urlVerificacion: (env.CAPTCHA_VERIFY_URL ?? '').trim() || undefined,
  };
}
