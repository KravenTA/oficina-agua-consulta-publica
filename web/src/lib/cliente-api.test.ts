// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { consultarEstadoCuenta } from './cliente-api';

function api(cuerpo: unknown, status = 200, cabeceras: Record<string, string> = {}) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(cuerpo), { status, headers: cabeceras }));
}

const base = { baseUrl: 'http://api:8081', numeroSerie: 'CTR-0001' };

describe('consultarEstadoCuenta', () => {
  it('llama por GET a la ruta del contrato con el numero de serie', async () => {
    const fetchFn = api({ ok: true });

    await consultarEstadoCuenta({ ...base, fetchFn });

    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toBe('http://api:8081/api/v1/consulta/contadores/CTR-0001/estado-cuenta');
    expect(init.method).toBe('GET');
  });

  it('envia la IP del cliente en X-Forwarded-For', async () => {
    const fetchFn = api({});

    await consultarEstadoCuenta({ ...base, ip: '203.0.113.7', fetchFn });

    expect(fetchFn.mock.calls[0][1].headers['X-Forwarded-For']).toBe('203.0.113.7');
  });

  it('no envia X-Forwarded-For si no se conoce la IP', async () => {
    const fetchFn = api({});

    await consultarEstadoCuenta({ ...base, ip: null, fetchFn });

    expect(fetchFn.mock.calls[0][1].headers).not.toHaveProperty('X-Forwarded-For');
  });

  it('codifica el numero de serie para que no pueda alterar la ruta', async () => {
    const fetchFn = api({});

    await consultarEstadoCuenta({ ...base, numeroSerie: '../admin?x=1', fetchFn });

    expect(String(fetchFn.mock.calls[0][0])).toBe(
      'http://api:8081/api/v1/consulta/contadores/..%2Fadmin%3Fx%3D1/estado-cuenta',
    );
  });

  it('devuelve el estado, el cuerpo y Retry-After', async () => {
    const fetchFn = api({ codigo: 'LIMITE_EXCEDIDO' }, 429, { 'Retry-After': '30' });

    const respuesta = await consultarEstadoCuenta({ ...base, fetchFn });

    expect(respuesta).toEqual({ status: 429, cuerpo: { codigo: 'LIMITE_EXCEDIDO' }, retryAfter: '30' });
  });

  it('devuelve null si el ApiRest no responde', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('sin red'));

    expect(await consultarEstadoCuenta({ ...base, fetchFn })).toBeNull();
  });

  it('si el cuerpo no es JSON, devuelve el estado con cuerpo null', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502 }));

    expect(await consultarEstadoCuenta({ ...base, fetchFn })).toEqual({ status: 502, cuerpo: null, retryAfter: null });
  });
});
