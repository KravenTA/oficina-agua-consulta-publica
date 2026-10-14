'use client';

import { useEffect, useRef, useState } from 'react';

export type CaptchaProvider = 'recaptcha' | 'hcaptcha';

type Props = {
  provider: CaptchaProvider;
  siteKey: string;
  /** Recibe el token cuando el usuario resuelve el captcha, y null cuando expira o falla. */
  onToken: (token: string | null) => void;
  /** Cada vez que cambia este numero, el captcha se reinicia (los tokens son de un solo uso). */
  resetKey: number;
};

// reCAPTCHA v2 y hCaptcha exponen la misma API explicita: render(elemento, opciones) y reset(id).
type ApiCaptcha = {
  render: (el: HTMLElement, opciones: Record<string, unknown>) => string | number;
  reset: (id?: string | number) => void;
};

const NOMBRE_GLOBAL: Record<CaptchaProvider, string> = { recaptcha: 'grecaptcha', hcaptcha: 'hcaptcha' };
const URL_SCRIPT: Record<CaptchaProvider, string> = {
  recaptcha: 'https://www.google.com/recaptcha/api.js',
  hcaptcha: 'https://js.hcaptcha.com/1/api.js',
};

// Una sola carga por proveedor, aunque React monte el componente dos veces (modo estricto).
const cargas: Partial<Record<CaptchaProvider, Promise<ApiCaptcha>>> = {};

function cargarApi(provider: CaptchaProvider): Promise<ApiCaptcha> {
  const global = window as unknown as Record<string, ApiCaptcha | undefined>;
  const yaCargada = global[NOMBRE_GLOBAL[provider]];
  if (yaCargada?.render) {
    return Promise.resolve(yaCargada);
  }

  const enCurso = cargas[provider];
  if (enCurso) {
    return enCurso;
  }

  const promesa = new Promise<ApiCaptcha>((resolve, reject) => {
    const nombreCallback = `__captchaListo_${provider}`;
    (window as unknown as Record<string, unknown>)[nombreCallback] = () => {
      resolve(global[NOMBRE_GLOBAL[provider]] as ApiCaptcha);
    };

    const script = document.createElement('script');
    script.src = `${URL_SCRIPT[provider]}?onload=${nombreCallback}&render=explicit&hl=es`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('No se pudo cargar el captcha'));
    document.head.appendChild(script);
  });

  // Si falla, se permite reintentar en la siguiente vez que se monte el componente.
  promesa.catch(() => {
    delete cargas[provider];
  });
  cargas[provider] = promesa;
  return promesa;
}

export function Captcha({ provider, siteKey, onToken, resetKey }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const api = useRef<ApiCaptcha | null>(null);
  const idWidget = useRef<string | number | null>(null);
  const alResolver = useRef(onToken);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');

  // Siempre se llama a la version mas reciente de onToken, sin volver a dibujar el captcha.
  useEffect(() => {
    alResolver.current = onToken;
  }, [onToken]);

  useEffect(() => {
    const padre = contenedor.current;
    if (!padre) {
      return;
    }
    let cancelado = false;
    // Cada montaje usa un elemento nuevo: el captcha no permite dibujarse dos veces en el mismo.
    const elemento = document.createElement('div');
    padre.appendChild(elemento);

    cargarApi(provider)
      .then((cargada) => {
        if (cancelado) {
          return;
        }
        api.current = cargada;
        idWidget.current = cargada.render(elemento, {
          sitekey: siteKey,
          callback: (token: string) => alResolver.current(token),
          'expired-callback': () => alResolver.current(null),
          'error-callback': () => alResolver.current(null),
        });
        setEstado('listo');
      })
      .catch(() => {
        if (!cancelado) {
          setEstado('error');
        }
      });

    return () => {
      cancelado = true;
      api.current = null;
      idWidget.current = null;
      elemento.remove();
    };
  }, [provider, siteKey]);

  const primerRender = useRef(true);
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    if (api.current && idWidget.current !== null) {
      api.current.reset(idWidget.current);
    }
  }, [resetKey]);

  return (
    <div className="captcha">
      <div className="captcha__widget" ref={contenedor} />
      {estado === 'cargando' && <p className="ayuda">Cargando verificación de seguridad…</p>}
      {estado === 'error' && (
        <p className="mensaje mensaje--error" role="alert">
          No se pudo cargar la verificación de seguridad. Revisa tu conexión y recarga la página.
        </p>
      )}
    </div>
  );
}
