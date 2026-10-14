import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Captcha } from './Captcha';

type Opciones = {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
};

describe('Captcha', () => {
  let opciones: Opciones;
  const renderizar = vi.fn((_el: HTMLElement, o: Opciones) => {
    opciones = o;
    return 7;
  });
  const reiniciar = vi.fn();

  beforeEach(() => {
    renderizar.mockClear();
    reiniciar.mockClear();
    // Con la API ya presente no se descarga ningun script externo.
    (window as unknown as Record<string, unknown>).grecaptcha = { render: renderizar, reset: reiniciar };
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).grecaptcha;
  });

  it('dibuja el widget con la clave publica', async () => {
    render(<Captcha provider="recaptcha" siteKey="clave-publica" onToken={vi.fn()} resetKey={0} />);

    await waitFor(() => expect(renderizar).toHaveBeenCalledTimes(1));
    expect(opciones.sitekey).toBe('clave-publica');
  });

  it('entrega el token al resolver y null al expirar o fallar', async () => {
    const alToken = vi.fn();
    render(<Captcha provider="recaptcha" siteKey="k" onToken={alToken} resetKey={0} />);
    await waitFor(() => expect(renderizar).toHaveBeenCalled());

    opciones.callback('token-abc');
    expect(alToken).toHaveBeenLastCalledWith('token-abc');

    opciones['expired-callback']();
    expect(alToken).toHaveBeenLastCalledWith(null);

    opciones.callback('otro');
    opciones['error-callback']();
    expect(alToken).toHaveBeenLastCalledWith(null);
  });

  it('se reinicia cuando cambia resetKey, pero no al montarse', async () => {
    const { rerender } = render(<Captcha provider="recaptcha" siteKey="k" onToken={vi.fn()} resetKey={0} />);
    await waitFor(() => expect(renderizar).toHaveBeenCalled());
    expect(reiniciar).not.toHaveBeenCalled();

    rerender(<Captcha provider="recaptcha" siteKey="k" onToken={vi.fn()} resetKey={1} />);

    expect(reiniciar).toHaveBeenCalledWith(7);
  });

  it('usa la API de hCaptcha cuando ese es el proveedor', async () => {
    delete (window as unknown as Record<string, unknown>).grecaptcha;
    (window as unknown as Record<string, unknown>).hcaptcha = { render: renderizar, reset: reiniciar };

    render(<Captcha provider="hcaptcha" siteKey="hk" onToken={vi.fn()} resetKey={0} />);

    await waitFor(() => expect(renderizar).toHaveBeenCalledTimes(1));
    expect(opciones.sitekey).toBe('hk');
    delete (window as unknown as Record<string, unknown>).hcaptcha;
  });

  it('quita el widget del DOM al desmontarse', async () => {
    const { container, unmount } = render(<Captcha provider="recaptcha" siteKey="k" onToken={vi.fn()} resetKey={0} />);
    await waitFor(() => expect(renderizar).toHaveBeenCalled());
    const widget = container.querySelector('.captcha__widget') as HTMLElement;
    expect(widget.children).toHaveLength(1);

    unmount();

    expect(widget.children).toHaveLength(0);
  });
});
