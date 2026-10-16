export type RespuestaApi = {
  status: number;
  cuerpo: unknown;
  retryAfter: string | null;
};

type Opciones = {
  baseUrl: string;
  numeroSerie: string;
  /** IP real del cliente, para el rate limit por IP del ApiRest. */
  ip?: string | null;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
};

/**
 * Llama por http al ApiRest de consulta. Devuelve null si no hubo respuesta (servicio caido
 * o demasiado lento). Esta funcion solo corre en el servidor: la URL del ApiRest no sale de aqui.
 */
export async function consultarEstadoCuenta(opciones: Opciones): Promise<RespuestaApi | null> {
  const { baseUrl, numeroSerie, ip, fetchFn = fetch, timeoutMs = 8000 } = opciones;

  const url = new URL(
    `/api/v1/consulta/contadores/${encodeURIComponent(numeroSerie)}/estado-cuenta`,
    baseUrl,
  );
  const cabeceras: Record<string, string> = { Accept: 'application/json' };
  if (ip) {
    // Reemplaza lo que haya traido el navegador: el ApiRest usa esta cabecera para contar por IP.
    cabeceras['X-Forwarded-For'] = ip;
  }

  let respuesta: Response;
  try {
    respuesta = await fetchFn(url, {
      method: 'GET',
      headers: cabeceras,
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return null;
  }

  let cuerpo: unknown = null;
  try {
    cuerpo = await respuesta.json();
  } catch {
    // Una respuesta que no es JSON (por ejemplo, de un proxy caido) se trata como error generico.
  }
  return { status: respuesta.status, cuerpo, retryAfter: respuesta.headers.get('retry-after') };
}
