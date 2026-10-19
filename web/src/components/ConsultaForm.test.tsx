import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConsultaForm } from './ConsultaForm';

// El captcha real carga scripts de Google; aqui se reemplaza por dos botones que simulan al usuario.
vi.mock('./Captcha', () => ({
  Captcha: ({ onToken, resetKey }: { onToken: (t: string | null) => void; resetKey: number }) => (
    <div data-testid="captcha" data-reset={resetKey}>
      <button type="button" onClick={() => onToken('token-123')}>
        resolver-captcha
      </button>
      <button type="button" onClick={() => onToken(null)}>
        expirar-captcha
      </button>
    </div>
  ),
}));

function respuesta(status: number, cuerpo: unknown = {}, cabeceras?: HeadersInit) {
  return Promise.resolve(new Response(JSON.stringify(cuerpo), { status, headers: cabeceras }));
}

const ESTADO_CUENTA = {
  contador: { numeroSerie: 'CTR-0001', tipoServicio: 'media_paja' },
  cliente: { nombreParcial: 'María L*** G***' },
  recibos: [
    {
      numero: '000124',
      periodo: { anio: 2026, mes: 9 },
      fechaEmision: '2026-09-01',
      fechaVencimiento: '2026-09-30',
      total: 45,
      estado: 'VENCIDO',
    },
    {
      numero: '000101',
      periodo: { anio: 2026, mes: 8 },
      fechaEmision: '2026-08-01',
      fechaVencimiento: '2026-08-31',
      total: 90,
      estado: 'PAGADO',
    },
  ],
  resumen: { totalEmitido: 135, totalPagado: 90, totalPendiente: 45, recibosPendientes: 0, recibosVencidos: 1 },
};

describe('ConsultaForm', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  const boton = () => screen.getByRole('button', { name: /consultar/i });
  const campo = () => screen.getByLabelText(/código del contador/i);

  it('empieza con el boton deshabilitado', () => {
    render(<ConsultaForm provider="recaptcha" siteKey="k" />);
    expect(boton()).toBeDisabled();
  });

  it('con codigo valido pero sin captcha sigue deshabilitado y avisa por que', async () => {
    const usuario = userEvent.setup();
    render(<ConsultaForm provider="recaptcha" siteKey="k" />);

    await usuario.type(campo(), 'CTR-0001');

    expect(boton()).toBeDisabled();
    expect(screen.getByText(/completa la verificación de seguridad para poder consultar/i)).toBeInTheDocument();
  });

  it('con captcha resuelto pero codigo invalido sigue deshabilitado', async () => {
    const usuario = userEvent.setup();
    render(<ConsultaForm provider="recaptcha" siteKey="k" />);

    await usuario.type(campo(), 'AB');
    await usuario.click(screen.getByText('resolver-captcha'));

    expect(boton()).toBeDisabled();
  });

  it('se habilita con codigo valido y captcha resuelto', async () => {
    const usuario = userEvent.setup();
    render(<ConsultaForm provider="recaptcha" siteKey="k" />);

    await usuario.type(campo(), 'CTR-0001');
    await usuario.click(screen.getByText('resolver-captcha'));

    expect(boton()).toBeEnabled();
  });

  it('se vuelve a deshabilitar si el captcha expira', async () => {
    const usuario = userEvent.setup();
    render(<ConsultaForm provider="recaptcha" siteKey="k" />);
    await usuario.type(campo(), 'CTR-0001');
    await usuario.click(screen.getByText('resolver-captcha'));
    expect(boton()).toBeEnabled();

    await usuario.click(screen.getByText('expirar-captcha'));

    expect(boton()).toBeDisabled();
  });

  it('muestra el error del campo al salir de el con un valor invalido', async () => {
    const usuario = userEvent.setup();
    render(<ConsultaForm provider="recaptcha" siteKey="k" />);

    await usuario.type(campo(), 'CTR 01');
    await usuario.tab();

    expect(screen.getByRole('alert')).toHaveTextContent(/solo letras, números y guiones/i);
    expect(campo()).toHaveAttribute('aria-invalid', 'true');
  });

  it('muestra el error de campo vacio al salir sin escribir', async () => {
    const usuario = userEvent.setup();
    render(<ConsultaForm provider="recaptcha" siteKey="k" />);

    await usuario.click(campo());
    await usuario.tab();

    expect(screen.getByRole('alert')).toHaveTextContent(/ingresa el código/i);
  });

  it('no envia nada si se dispara el formulario sin captcha (por ejemplo con Enter)', async () => {
    const usuario = userEvent.setup();
    const { container } = render(<ConsultaForm provider="recaptcha" siteKey="k" />);
    await usuario.type(campo(), 'CTR-0001');

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(/completa la verificación/i);
  });

  it('envia el codigo y el token, y reinicia el captcha', async () => {
    const usuario = userEvent.setup();
    fetchMock.mockReturnValue(respuesta(200, ESTADO_CUENTA));
    render(<ConsultaForm provider="recaptcha" siteKey="k" />);
    await usuario.type(campo(), '  ctr-0001 ');
    await usuario.click(screen.getByText('resolver-captcha'));

    await usuario.click(boton());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/consulta');
    expect(opciones.method).toBe('POST');
    expect(JSON.parse(opciones.body)).toEqual({ numeroSerie: 'ctr-0001', captchaToken: 'token-123' });
    expect(await screen.findByRole('heading', { name: /estado de cuenta/i })).toBeInTheDocument();
    expect(screen.getByText('María L*** G***')).toBeInTheDocument();
  });

  it('al consultar otro codigo vuelve al formulario limpio, con el captcha reiniciado y el boton bloqueado', async () => {
    const usuario = userEvent.setup();
    fetchMock.mockReturnValue(respuesta(200, ESTADO_CUENTA));
    render(<ConsultaForm provider="recaptcha" siteKey="k" />);
    await usuario.type(campo(), 'CTR-0001');
    await usuario.click(screen.getByText('resolver-captcha'));
    await usuario.click(boton());
    await usuario.click(await screen.findByRole('button', { name: /consultar otro código/i }));

    expect(campo()).toHaveValue('');
    // El token es de un solo uso: el captcha se reinicia y el boton vuelve a bloquearse.
    expect(Number(screen.getByTestId('captcha').getAttribute('data-reset'))).toBeGreaterThan(0);
    expect(boton()).toBeDisabled();
  });

  it('si el servidor responde 200 con un cuerpo inesperado muestra un error y no un estado de cuenta roto', async () => {
    const usuario = userEvent.setup();
    fetchMock.mockReturnValue(respuesta(200, { cualquier: 'cosa' }));
    render(<ConsultaForm provider="recaptcha" siteKey="k" />);
    await usuario.type(campo(), 'CTR-0001');
    await usuario.click(screen.getByText('resolver-captcha'));

    await usuario.click(boton());

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo completar/i);
    expect(screen.queryByRole('heading', { name: /estado de cuenta/i })).not.toBeInTheDocument();
  });

  it('en un 429 indica cuantos segundos esperar segun Retry-After', async () => {
    const usuario = userEvent.setup();
    fetchMock.mockReturnValue(respuesta(429, {}, { 'Retry-After': '45' }));
    render(<ConsultaForm provider="recaptcha" siteKey="k" />);
    await usuario.type(campo(), 'CTR-0001');
    await usuario.click(screen.getByText('resolver-captcha'));

    await usuario.click(boton());

    expect(await screen.findByRole('alert')).toHaveTextContent(/intenta de nuevo en 45 segundos/i);
  });

  it.each([
    [400, /no es válido/i],
    [404, /no encontramos un contador/i],
    [429, /demasiadas consultas/i],
    [403, /no pudimos validar la verificación/i],
    [503, /no está disponible por el momento/i],
    [500, /no se pudo completar/i],
  ])('muestra un mensaje claro cuando el servidor responde %i', async (status, mensaje) => {
    const usuario = userEvent.setup();
    fetchMock.mockReturnValue(respuesta(status));
    render(<ConsultaForm provider="recaptcha" siteKey="k" />);
    await usuario.type(campo(), 'CTR-0001');
    await usuario.click(screen.getByText('resolver-captcha'));

    await usuario.click(boton());

    expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);
  });

  it('avisa si no hay conexion', async () => {
    const usuario = userEvent.setup();
    fetchMock.mockRejectedValue(new TypeError('fallo de red'));
    render(<ConsultaForm provider="recaptcha" siteKey="k" />);
    await usuario.type(campo(), 'CTR-0001');
    await usuario.click(screen.getByText('resolver-captcha'));

    await usuario.click(boton());

    expect(await screen.findByRole('alert')).toHaveTextContent(/no hay conexión/i);
  });

  it('sin clave del captcha avisa y no permite enviar', async () => {
    const usuario = userEvent.setup();
    render(<ConsultaForm provider="recaptcha" siteKey="" />);

    await usuario.type(campo(), 'CTR-0001');

    expect(screen.getByRole('alert')).toHaveTextContent(/no está configurada/i);
    expect(screen.queryByTestId('captcha')).not.toBeInTheDocument();
    expect(boton()).toBeDisabled();
  });
});
