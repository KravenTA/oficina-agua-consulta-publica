// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { verificarCaptcha } from './captcha-servidor';

function proveedor(cuerpo: unknown, status = 200) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(cuerpo), { status }));
}

const base = { provider: 'recaptcha' as const, secreto: 'SECRETO', token: 'token-abc' };

describe('verificarCaptcha', () => {
  it('acepta un token que el proveedor da por bueno', async () => {
    const fetchFn = proveedor({ success: true });

    const resultado = await verificarCaptcha({ ...base, fetchFn });

    expect(resultado).toEqual({ ok: true });
  });

  it('envia la clave secreta, el token y la IP al proveedor, por POST', async () => {
    const fetchFn = proveedor({ success: true });

    await verificarCaptcha({ ...base, ip: '203.0.113.7', fetchFn });

    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://www.google.com/recaptcha/api/siteverify');
    expect(init.method).toBe('POST');
    const enviado = new URLSearchParams(init.body);
    expect(enviado.get('secret')).toBe('SECRETO');
    expect(enviado.get('response')).toBe('token-abc');
    expect(enviado.get('remoteip')).toBe('203.0.113.7');
  });

  it('no envia remoteip si no se conoce la IP', async () => {
    const fetchFn = proveedor({ success: true });

    await verificarCaptcha({ ...base, ip: null, fetchFn });

    expect(new URLSearchParams(fetchFn.mock.calls[0][1].body).has('remoteip')).toBe(false);
  });

  it('usa la direccion de hCaptcha cuando ese es el proveedor', async () => {
    const fetchFn = proveedor({ success: true });

    await verificarCaptcha({ ...base, provider: 'hcaptcha', fetchFn });

    expect(fetchFn.mock.calls[0][0]).toBe('https://api.hcaptcha.com/siteverify');
  });

  it('rechaza un token que el proveedor no acepta', async () => {
    const fetchFn = proveedor({ success: false, 'error-codes': ['invalid-input-response'] });

    expect(await verificarCaptcha({ ...base, fetchFn })).toEqual({ ok: false, motivo: 'invalido' });
  });

  it('rechaza un token ya usado', async () => {
    const fetchFn = proveedor({ success: false, 'error-codes': ['timeout-or-duplicate'] });

    expect(await verificarCaptcha({ ...base, fetchFn })).toEqual({ ok: false, motivo: 'invalido' });
  });

  it.each(['invalid-input-secret', 'missing-input-secret', 'sitekey-secret-mismatch'])(
    'si el proveedor dice "%s", el problema es de configuracion y no del usuario',
    async (codigo) => {
      const fetchFn = proveedor({ success: false, 'error-codes': [codigo] });

      expect(await verificarCaptcha({ ...base, fetchFn })).toEqual({ ok: false, motivo: 'no_configurado' });
    },
  );

  it('sin clave secreta configurada no llama al proveedor', async () => {
    const fetchFn = proveedor({ success: true });

    const resultado = await verificarCaptcha({ ...base, secreto: '', fetchFn });

    expect(resultado).toEqual({ ok: false, motivo: 'no_configurado' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('si el proveedor no responde, informa que no esta disponible', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('sin red'));

    expect(await verificarCaptcha({ ...base, fetchFn })).toEqual({ ok: false, motivo: 'no_disponible' });
  });

  it('si el proveedor responde con error del servidor, informa que no esta disponible', async () => {
    const fetchFn = proveedor({}, 503);

    expect(await verificarCaptcha({ ...base, fetchFn })).toEqual({ ok: false, motivo: 'no_disponible' });
  });

  it('si la respuesta del proveedor no es JSON, informa que no esta disponible', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('<html>caido</html>', { status: 200 }));

    expect(await verificarCaptcha({ ...base, fetchFn })).toEqual({ ok: false, motivo: 'no_disponible' });
  });

  it('permite apuntar a otra direccion de verificacion (para pruebas)', async () => {
    const fetchFn = proveedor({ success: true });

    await verificarCaptcha({ ...base, urlVerificacion: 'http://falso.local/verify', fetchFn });

    expect(fetchFn.mock.calls[0][0]).toBe('http://falso.local/verify');
  });
});
