// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

const URL_API = 'http://api-interna:8081';
const URL_CAPTCHA = 'https://www.google.com/recaptcha/api/siteverify';

const ESTADO_CUENTA = {
  contador: { numeroSerie: 'CTR-0003' },
  cliente: { nombreParcial: 'Carlos P*** R***' },
  recibos: [],
  resumen: { totalEmitido: 0 },
};

type Escenario = {
  captcha?: unknown | Error;
  api?: { status: number; cuerpo?: unknown; cabeceras?: Record<string, string> } | Error;
};

/** Reemplaza fetch: responde segun la direccion a la que se llame. */
function simularRed({ captcha = { success: true }, api = { status: 200, cuerpo: ESTADO_CUENTA } }: Escenario = {}) {
  const mock = vi.fn(async (entrada: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(entrada);
    if (url === URL_CAPTCHA) {
      if (captcha instanceof Error) throw captcha;
      return new Response(JSON.stringify(captcha), { status: 200 });
    }
    if (url.startsWith(URL_API)) {
      if (api instanceof Error) throw api;
      return new Response(JSON.stringify(api.cuerpo ?? {}), { status: api.status, headers: api.cabeceras });
    }
    throw new Error(`Llamada inesperada a ${url}`);
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

const llamadasAlApi = (mock: ReturnType<typeof simularRed>) =>
  mock.mock.calls.filter(([url]) => String(url).startsWith(URL_API));

function pedido(cuerpo: unknown, cabeceras: Record<string, string> = {}) {
  return new Request('http://localhost:3000/api/consulta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabeceras },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  });
}

const valido = { numeroSerie: 'CTR-0003', captchaToken: 'token-bueno' };

describe('POST /api/consulta', () => {
  beforeEach(() => {
    vi.stubEnv('CAPTCHA_PROVIDER', 'recaptcha');
    vi.stubEnv('CAPTCHA_SECRET_KEY', 'SECRETO-DEL-SERVIDOR');
    vi.stubEnv('API_INTERNAL_URL', URL_API);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('camino feliz', () => {
    it('verifica el captcha, llama al ApiRest y devuelve el estado de cuenta', async () => {
      const red = simularRed();

      const respuesta = await POST(pedido(valido));

      expect(respuesta.status).toBe(200);
      expect(await respuesta.json()).toEqual(ESTADO_CUENTA);
      expect(llamadasAlApi(red)).toHaveLength(1);
    });

    it('verifica el token con la clave secreta del servidor', async () => {
      const red = simularRed();

      await POST(pedido(valido));

      const [, init] = red.mock.calls.find(([url]) => String(url) === URL_CAPTCHA)!;
      const enviado = new URLSearchParams((init as RequestInit).body as URLSearchParams);
      expect(enviado.get('secret')).toBe('SECRETO-DEL-SERVIDOR');
      expect(enviado.get('response')).toBe('token-bueno');
    });

    it('pasa al ApiRest la IP real del cliente en X-Forwarded-For', async () => {
      const red = simularRed();

      await POST(pedido(valido, { 'x-forwarded-for': '203.0.113.7' }));

      const [, init] = llamadasAlApi(red)[0];
      expect((init as RequestInit & { headers: Record<string, string> }).headers['X-Forwarded-For']).toBe('203.0.113.7');
    });

    it('usa la URL interna configurada en API_INTERNAL_URL', async () => {
      const red = simularRed();

      await POST(pedido(valido));

      expect(String(llamadasAlApi(red)[0][0])).toBe(
        `${URL_API}/api/v1/consulta/contadores/CTR-0003/estado-cuenta`,
      );
    });

    it('la respuesta no se guarda en cache', async () => {
      simularRed();

      const respuesta = await POST(pedido(valido));

      expect(respuesta.headers.get('cache-control')).toBe('no-store');
    });
  });

  describe('captcha invalido: el ApiRest NO se llama', () => {
    it('token que el proveedor rechaza', async () => {
      const red = simularRed({ captcha: { success: false, 'error-codes': ['invalid-input-response'] } });

      const respuesta = await POST(pedido(valido));

      expect(respuesta.status).toBe(403);
      expect((await respuesta.json()).codigo).toBe('CAPTCHA_INVALIDO');
      expect(llamadasAlApi(red)).toHaveLength(0);
    });

    it('token reutilizado', async () => {
      const red = simularRed({ captcha: { success: false, 'error-codes': ['timeout-or-duplicate'] } });

      const respuesta = await POST(pedido(valido));

      expect(respuesta.status).toBe(403);
      expect(llamadasAlApi(red)).toHaveLength(0);
    });

    it.each([
      ['sin token', { numeroSerie: 'CTR-0003' }],
      ['token vacio', { numeroSerie: 'CTR-0003', captchaToken: '' }],
      ['token solo con espacios', { numeroSerie: 'CTR-0003', captchaToken: '   ' }],
      ['token que no es texto', { numeroSerie: 'CTR-0003', captchaToken: 12345 }],
      ['token enorme', { numeroSerie: 'CTR-0003', captchaToken: 'x'.repeat(5000) }],
    ])('%s: se rechaza sin llamar a nadie', async (_nombre, cuerpo) => {
      const red = simularRed();

      const respuesta = await POST(pedido(cuerpo));

      expect(respuesta.status).toBe(403);
      expect((await respuesta.json()).codigo).toBe('CAPTCHA_INVALIDO');
      expect(red).not.toHaveBeenCalled();
    });
  });

  describe('fallas de configuracion y de servicios', () => {
    it('sin CAPTCHA_SECRET_KEY responde error de configuracion y no llama al ApiRest', async () => {
      vi.stubEnv('CAPTCHA_SECRET_KEY', '');
      const red = simularRed();

      const respuesta = await POST(pedido(valido));

      expect(respuesta.status).toBe(500);
      expect((await respuesta.json()).codigo).toBe('ERROR_CONFIGURACION');
      expect(red).not.toHaveBeenCalled();
    });

    it('si el proveedor del captcha no responde, informa 503 y no llama al ApiRest', async () => {
      const red = simularRed({ captcha: new TypeError('sin red') });

      const respuesta = await POST(pedido(valido));

      expect(respuesta.status).toBe(503);
      expect((await respuesta.json()).codigo).toBe('CAPTCHA_NO_DISPONIBLE');
      expect(llamadasAlApi(red)).toHaveLength(0);
    });

    it('si el ApiRest no responde, informa 503', async () => {
      simularRed({ api: new TypeError('conexion rechazada') });

      const respuesta = await POST(pedido(valido));

      expect(respuesta.status).toBe(503);
      expect((await respuesta.json()).codigo).toBe('SERVICIO_NO_DISPONIBLE');
    });

    it('una respuesta inesperada del ApiRest (por ejemplo 502) se informa como 503', async () => {
      simularRed({ api: { status: 502, cuerpo: null } });

      const respuesta = await POST(pedido(valido));

      expect(respuesta.status).toBe(503);
    });
  });

  describe('errores del ApiRest que se reenvian al navegador', () => {
    it('404: contador no encontrado', async () => {
      const cuerpo = { codigo: 'CONTADOR_NO_ENCONTRADO', mensaje: 'No se encontró un contador.', fecha: 'x' };
      simularRed({ api: { status: 404, cuerpo } });

      const respuesta = await POST(pedido(valido));

      expect(respuesta.status).toBe(404);
      expect((await respuesta.json()).codigo).toBe('CONTADOR_NO_ENCONTRADO');
    });

    it('429: limite de consultas, con Retry-After', async () => {
      const cuerpo = { codigo: 'LIMITE_EXCEDIDO', mensaje: 'Demasiadas consultas.', fecha: 'x' };
      simularRed({ api: { status: 429, cuerpo, cabeceras: { 'Retry-After': '42' } } });

      const respuesta = await POST(pedido(valido));

      expect(respuesta.status).toBe(429);
      expect(respuesta.headers.get('retry-after')).toBe('42');
      expect((await respuesta.json()).codigo).toBe('LIMITE_EXCEDIDO');
    });

    it.each([400, 500, 503])('%i: se reenvia con su codigo', async (status) => {
      const cuerpo = { codigo: 'ERROR_INTERNO', mensaje: 'Falla.', fecha: 'x' };
      simularRed({ api: { status, cuerpo } });

      const respuesta = await POST(pedido(valido));

      expect(respuesta.status).toBe(status);
    });
  });

  describe('validacion del pedido', () => {
    it('rechaza un cuerpo que no es JSON, sin llamar a nadie', async () => {
      const red = simularRed();

      const respuesta = await POST(pedido('esto no es json'));

      expect(respuesta.status).toBe(400);
      expect((await respuesta.json()).codigo).toBe('SOLICITUD_INVALIDA');
      expect(red).not.toHaveBeenCalled();
    });

    it.each([
      ['null', 'null'],
      ['un arreglo', '[]'],
      ['sin numeroSerie', '{"captchaToken":"x"}'],
      ['numeroSerie que no es texto', '{"numeroSerie":123,"captchaToken":"x"}'],
    ])('rechaza %s', async (_nombre, cuerpo) => {
      const red = simularRed();

      const respuesta = await POST(pedido(cuerpo));

      expect(respuesta.status).toBe(400);
      expect(red).not.toHaveBeenCalled();
    });

    it('rechaza un cuerpo demasiado grande', async () => {
      const red = simularRed();

      const respuesta = await POST(pedido({ ...valido, relleno: 'x'.repeat(20_000) }));

      expect(respuesta.status).toBe(400);
      expect(red).not.toHaveBeenCalled();
    });

    it.each(['AB', 'CTR_0001', 'CTR 0001', '../etc/passwd', ''])(
      'el servidor valida el codigo "%s" aunque el navegador no lo haya hecho',
      async (numeroSerie) => {
        const red = simularRed();

        const respuesta = await POST(pedido({ numeroSerie, captchaToken: 'token-bueno' }));

        expect(respuesta.status).toBe(400);
        expect((await respuesta.json()).codigo).toBe('SERIE_INVALIDA');
        // Un codigo invalido tampoco gasta el token del captcha.
        expect(red).not.toHaveBeenCalled();
      },
    );
  });

  describe('lo que el navegador nunca debe ver', () => {
    it.each([
      ['respuesta exitosa', {}],
      ['captcha invalido', { captcha: { success: false } }],
      ['ApiRest caido', { api: new TypeError('conexion rechazada a http://api-interna:8081') }],
      ['proveedor del captcha caido', { captcha: new TypeError('sin red') }],
    ] as [string, Escenario][])('%s: ni la URL del ApiRest ni la clave secreta', async (_nombre, escenario) => {
      simularRed(escenario);

      const respuesta = await POST(pedido(valido));
      const visible = JSON.stringify(await respuesta.json()) + JSON.stringify([...respuesta.headers]);

      expect(visible).not.toContain('api-interna');
      expect(visible).not.toContain('8081');
      expect(visible).not.toContain('SECRETO-DEL-SERVIDOR');
    });
  });
});
