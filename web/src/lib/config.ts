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
