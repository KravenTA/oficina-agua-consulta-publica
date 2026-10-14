import { describe, expect, it } from 'vitest';

import { validarSerie } from './validacion';

describe('validarSerie', () => {
  it.each(['CTR-0001', 'abc', 'A1-b2', 'x'.repeat(30)])('acepta "%s"', (codigo) => {
    expect(validarSerie(codigo).error).toBeNull();
  });

  it('recorta los espacios de los extremos', () => {
    const resultado = validarSerie('  CTR-0001  ');
    expect(resultado.error).toBeNull();
    expect(resultado.valor).toBe('CTR-0001');
  });

  it('rechaza un campo vacio o de solo espacios', () => {
    expect(validarSerie('').error).toMatch(/ingresa/i);
    expect(validarSerie('    ').error).toMatch(/ingresa/i);
  });

  it('rechaza menos de 3 caracteres', () => {
    expect(validarSerie('AB').error).toMatch(/al menos 3/i);
  });

  it('rechaza mas de 30 caracteres', () => {
    expect(validarSerie('x'.repeat(31)).error).toMatch(/más de 30/i);
  });

  it.each(['CTR_0001', 'CTR 0001', 'CTR-ñ01', 'CTR-0001;', "CTR'--"])('rechaza caracteres no permitidos en "%s"', (codigo) => {
    expect(validarSerie(codigo).error).toMatch(/solo letras, números y guiones/i);
  });
});
