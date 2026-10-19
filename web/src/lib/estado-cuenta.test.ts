import { describe, expect, it } from 'vitest';

import { esEstadoCuenta, formatearFecha, formatearMonto, formatearPeriodo } from './estado-cuenta';

describe('formatearMonto', () => {
  it.each([
    [45, 'Q 45.00'],
    [0, 'Q 0.00'],
    [1234.5, 'Q 1,234.50'],
    [1234567.891, 'Q 1,234,567.89'],
  ])('%s -> %s', (valor, esperado) => {
    expect(formatearMonto(valor)).toBe(esperado);
  });
});

describe('formatearPeriodo', () => {
  it('escribe el mes en español', () => {
    expect(formatearPeriodo({ anio: 2026, mes: 9 })).toBe('Septiembre 2026');
    expect(formatearPeriodo({ anio: 2026, mes: 1 })).toBe('Enero 2026');
  });

  it('si el mes no existe no falla', () => {
    expect(formatearPeriodo({ anio: 2026, mes: 13 })).toBe('13/2026');
  });
});

describe('formatearFecha', () => {
  it('cambia de AAAA-MM-DD a DD/MM/AAAA sin mover el dia', () => {
    expect(formatearFecha('2026-09-30')).toBe('30/09/2026');
    expect(formatearFecha('2026-01-01')).toBe('01/01/2026');
  });

  it('devuelve vacio si no hay fecha', () => {
    expect(formatearFecha(null)).toBe('');
    expect(formatearFecha(undefined)).toBe('');
    expect(formatearFecha('no-es-fecha')).toBe('');
  });
});

describe('esEstadoCuenta', () => {
  const valido = {
    contador: { numeroSerie: 'CTR-0001' },
    cliente: { nombreParcial: 'Ana L***' },
    recibos: [],
    resumen: { totalEmitido: 0, totalPagado: 0, totalPendiente: 0, recibosPendientes: 0, recibosVencidos: 0 },
  };

  it('acepta una respuesta completa, incluso sin recibos', () => {
    expect(esEstadoCuenta(valido)).toBe(true);
  });

  it.each([null, undefined, 'texto', 42, {}, { ...valido, cliente: {} }, { ...valido, recibos: 'x' }])(
    'rechaza %j',
    (entrada) => {
      expect(esEstadoCuenta(entrada)).toBe(false);
    },
  );

  it('rechaza un recibo con estado desconocido', () => {
    const recibo = { numero: '1', periodo: { anio: 2026, mes: 1 }, fechaEmision: '2026-01-01', total: 10, estado: 'RARO' };
    expect(esEstadoCuenta({ ...valido, recibos: [recibo] })).toBe(false);
  });
});
