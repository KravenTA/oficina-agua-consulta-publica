import { describe, expect, it } from 'vitest';

import { configCaptcha } from './config';

describe('configCaptcha', () => {
  it('usa reCAPTCHA por defecto', () => {
    expect(configCaptcha({}).provider).toBe('recaptcha');
  });

  it('acepta hCaptcha sin importar mayusculas', () => {
    expect(configCaptcha({ CAPTCHA_PROVIDER: 'HCaptcha' }).provider).toBe('hcaptcha');
  });

  it('un proveedor desconocido cae en reCAPTCHA', () => {
    expect(configCaptcha({ CAPTCHA_PROVIDER: 'otro' }).provider).toBe('recaptcha');
  });

  it('lee la clave publica y quita espacios', () => {
    expect(configCaptcha({ CAPTCHA_SITE_KEY: '  clave-publica ' }).siteKey).toBe('clave-publica');
  });

  it('sin clave devuelve texto vacio', () => {
    expect(configCaptcha({}).siteKey).toBe('');
  });

  it('nunca expone la clave secreta', () => {
    const config = configCaptcha({ CAPTCHA_SITE_KEY: 'publica', CAPTCHA_SECRET_KEY: 'secreta' });
    expect(JSON.stringify(config)).not.toContain('secreta');
  });
});
