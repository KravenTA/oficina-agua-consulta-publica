/**
 * Misma regla que el contrato del ApiRest (api/openapi/consulta-api.yaml):
 * entre 3 y 30 caracteres, solo letras, numeros y guiones.
 */
const FORMATO_SERIE = /^[A-Za-z0-9-]{3,30}$/;

export type ResultadoSerie = { valor: string; error: null } | { valor: string; error: string };

export function validarSerie(entrada: string): ResultadoSerie {
  const valor = entrada.trim();

  if (valor.length === 0) {
    return { valor, error: 'Ingresa el código de tu contador.' };
  }
  if (valor.length < 3) {
    return { valor, error: 'El código debe tener al menos 3 caracteres.' };
  }
  if (valor.length > 30) {
    return { valor, error: 'El código no puede tener más de 30 caracteres.' };
  }
  if (!FORMATO_SERIE.test(valor)) {
    return { valor, error: 'Usa solo letras, números y guiones (sin espacios).' };
  }
  return { valor, error: null };
}
