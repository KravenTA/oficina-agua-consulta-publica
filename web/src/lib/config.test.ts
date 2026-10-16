import { describe, expect, it } from 'vitest';

import { configCaptcha, configServidor } from './config';

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

describe('configServidor', () => {
  it('lee la clave secreta y la URL interna del ApiRest', () => {
    const config = configServidor({ CAPTCHA_SECRET_KEY: ' secreta ', API_INTERNAL_URL: 'http://api:8081' });
    expect(config.secreto).toBe('secreta');
    expect(config.apiUrl).toBe('http://api:8081');
  });

  it('sin API_INTERNAL_URL usa el ApiRest local', () => {
    expect(configServidor({}).apiUrl).toBe('http://localhost:8081');
  });

  it('sin clave secreta devuelve texto vacio', () => {
    expect(configServidor({}).secreto).toBe('');
  });

  it('la verificacion alternativa solo existe si se configura', () => {
    expect(configServidor({}).urlVerificacion).toBeUndefined();
    expect(configServidor({ CAPTCHA_VERIFY_URL: 'http://falso/verify' }).urlVerificacion).toBe('http://falso/verify');
  });
});
