'use client';

import { useId, useState, type FormEvent } from 'react';

import { validarSerie } from '@/lib/validacion';

import { Captcha, type CaptchaProvider } from './Captcha';

type Props = {
  provider: CaptchaProvider;
  /** Clave publica del captcha. Si viene vacia, el formulario avisa y no permite enviar. */
  siteKey: string;
};

type Estado =
  | { tipo: 'inactivo' }
  | { tipo: 'enviando' }
  | { tipo: 'ok' }
  | { tipo: 'error'; mensaje: string };

function mensajeDeError(status: number): string {
  switch (status) {
    case 400:
      return 'El código ingresado no es válido.';
    case 404:
      return 'No encontramos un contador con ese código.';
    case 429:
      return 'Hiciste demasiadas consultas. Intenta de nuevo en unos segundos.';
    case 501:
      return 'La consulta todavía no está disponible.';
    default:
      return 'No se pudo completar la consulta. Intenta más tarde.';
  }
}

export function ConsultaForm({ provider, siteKey }: Props) {
  const idCampo = useId();
  const idError = `${idCampo}-error`;

  const [serie, setSerie] = useState('');
  const [tocado, setTocado] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [estado, setEstado] = useState<Estado>({ tipo: 'inactivo' });

  const errorSerie = tocado ? validarSerie(serie).error : null;
  const enviando = estado.tipo === 'enviando';
  const captchaConfigurado = siteKey !== '';
  const puedeEnviar = validarSerie(serie).error === null && token !== null && captchaConfigurado && !enviando;

  async function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setTocado(true);

    const resultado = validarSerie(serie);
    if (resultado.error || enviando) {
      return;
    }
    // El boton ya esta deshabilitado sin captcha; esto cubre el envio con la tecla Enter.
    if (token === null) {
      setEstado({ tipo: 'error', mensaje: 'Completa la verificación de seguridad para continuar.' });
      return;
    }

    setEstado({ tipo: 'enviando' });
    try {
      const respuesta = await fetch('/api/consulta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numeroSerie: resultado.valor, captchaToken: token }),
      });
      setEstado(respuesta.ok ? { tipo: 'ok' } : { tipo: 'error', mensaje: mensajeDeError(respuesta.status) });
    } catch {
      setEstado({ tipo: 'error', mensaje: 'No hay conexión con el servidor. Intenta de nuevo.' });
    } finally {
      // Un token del captcha solo sirve una vez: hay que resolverlo otra vez para volver a consultar.
      setToken(null);
      setResetKey((n) => n + 1);
    }
  }

  return (
    <form className="formulario" onSubmit={alEnviar} noValidate>
      <div className="campo">
        <label htmlFor={idCampo}>Código del contador</label>
        <input
          id={idCampo}
          name="numeroSerie"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="Ej. CTR-0001"
          maxLength={40}
          value={serie}
          onChange={(e) => setSerie(e.target.value)}
          onBlur={() => setTocado(true)}
          aria-invalid={errorSerie !== null}
          aria-describedby={errorSerie ? idError : undefined}
          disabled={enviando}
        />
        {errorSerie ? (
          <p id={idError} className="mensaje mensaje--error" role="alert">
            {errorSerie}
          </p>
        ) : (
          <p className="ayuda">Lo encuentras en tu recibo de agua.</p>
        )}
      </div>

      {captchaConfigurado ? (
        <Captcha
          provider={provider}
          siteKey={siteKey}
          resetKey={resetKey}
          onToken={(valor) => {
            setToken(valor);
            if (valor !== null) {
              setEstado((actual) => (actual.tipo === 'error' ? { tipo: 'inactivo' } : actual));
            }
          }}
        />
      ) : (
        <p className="mensaje mensaje--error" role="alert">
          La verificación de seguridad no está configurada. Avisa al administrador del sistema.
        </p>
      )}

      <button type="submit" className="boton" disabled={!puedeEnviar}>
        {enviando ? 'Consultando…' : 'Consultar'}
      </button>
      {captchaConfigurado && token === null && !enviando && (
        <p className="ayuda ayuda--centro">Completa la verificación de seguridad para poder consultar.</p>
      )}

      {estado.tipo === 'error' && (
        <p className="mensaje mensaje--error" role="alert">
          {estado.mensaje}
        </p>
      )}
      {estado.tipo === 'ok' && (
        <p className="mensaje mensaje--ok" role="status">
          Consulta realizada.
        </p>
      )}
    </form>
  );
}
