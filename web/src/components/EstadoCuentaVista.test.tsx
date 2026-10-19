import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { EstadoCuenta, Recibo } from '@/lib/estado-cuenta';

import { EstadoCuentaVista } from './EstadoCuentaVista';

function recibo(parcial: Partial<Recibo>): Recibo {
  return {
    numero: '000001',
    periodo: { anio: 2026, mes: 9 },
    fechaEmision: '2026-09-01',
    fechaVencimiento: '2026-09-30',
    total: 45,
    estado: 'PENDIENTE',
    ...parcial,
  };
}

function datos(parcial: Partial<EstadoCuenta> = {}): EstadoCuenta {
  return {
    contador: { numeroSerie: 'CTR-0001' },
    cliente: { nombreParcial: 'María L*** G***' },
    recibos: [],
    resumen: { totalEmitido: 0, totalPagado: 0, totalPendiente: 0, recibosPendientes: 0, recibosVencidos: 0 },
    ...parcial,
  };
}

const vista = (d: EstadoCuenta, onNuevaConsulta = vi.fn()) =>
  render(<EstadoCuentaVista datos={d} onNuevaConsulta={onNuevaConsulta} />);

describe('EstadoCuentaVista', () => {
  it('muestra el nombre parcial del cliente y el codigo del contador', () => {
    vista(datos());

    expect(screen.getByText('María L*** G***')).toBeInTheDocument();
    expect(screen.getByText(/contador ctr-0001/i)).toBeInTheDocument();
  });

  it('lista cada recibo con numero, periodo, monto y estado', () => {
    vista(
      datos({
        recibos: [
          recibo({ numero: '000124', periodo: { anio: 2026, mes: 9 }, total: 45, estado: 'PENDIENTE' }),
          recibo({ numero: '000101', periodo: { anio: 2026, mes: 8 }, total: 1234.5, estado: 'PAGADO' }),
        ],
      }),
    );

    const filas = screen.getAllByRole('row').slice(1); // sin el encabezado
    expect(filas).toHaveLength(2);
    expect(within(filas[0]).getByText('000124')).toBeInTheDocument();
    expect(within(filas[0]).getByText('Septiembre 2026')).toBeInTheDocument();
    expect(within(filas[0]).getByText('Q 45.00')).toBeInTheDocument();
    expect(within(filas[0]).getByText('Pendiente')).toBeInTheDocument();
    expect(within(filas[1]).getByText('Q 1,234.50')).toBeInTheDocument();
    expect(within(filas[1]).getByText('Pagado')).toBeInTheDocument();
  });

  it('resalta los recibos vencidos y dice cuando vencieron', () => {
    vista(
      datos({
        recibos: [
          recibo({ numero: '000124', estado: 'VENCIDO', fechaVencimiento: '2026-09-30' }),
          recibo({ numero: '000125', estado: 'PENDIENTE' }),
        ],
      }),
    );

    const [vencido, pendiente] = screen.getAllByRole('row').slice(1);
    expect(vencido).toHaveClass('recibo--vencido');
    expect(within(vencido).getByText('Vencido')).toBeInTheDocument();
    expect(within(vencido).getByText(/venció el 30\/09\/2026/i)).toBeInTheDocument();
    expect(pendiente).not.toHaveClass('recibo--vencido');
    expect(within(pendiente).queryByText(/venció el/i)).not.toBeInTheDocument();
  });

  it('muestra cuanto debe el cliente y desglosa vencidos y pendientes', () => {
    vista(
      datos({
        recibos: [recibo({ estado: 'VENCIDO' })],
        resumen: { totalEmitido: 135, totalPagado: 45, totalPendiente: 90, recibosPendientes: 1, recibosVencidos: 1 },
      }),
    );

    const resumen = screen.getByRole('status');
    expect(resumen).toHaveTextContent(/total pendiente de pago/i);
    expect(resumen).toHaveTextContent('Q 90.00');
    expect(resumen).toHaveTextContent('1 recibo vencido y 1 recibo pendiente');
  });

  it('usa el plural cuando hay varios recibos', () => {
    vista(
      datos({
        recibos: [recibo({ estado: 'VENCIDO' })],
        resumen: { totalEmitido: 90, totalPagado: 0, totalPendiente: 90, recibosPendientes: 0, recibosVencidos: 2 },
      }),
    );

    expect(screen.getByRole('status')).toHaveTextContent('2 recibos vencidos');
  });

  it('si no debe nada dice que esta al dia', () => {
    vista(
      datos({
        recibos: [recibo({ estado: 'PAGADO' })],
        resumen: { totalEmitido: 45, totalPagado: 45, totalPendiente: 0, recibosPendientes: 0, recibosVencidos: 0 },
      }),
    );

    expect(screen.getByRole('status')).toHaveTextContent(/estás al día/i);
    expect(screen.getByRole('status')).toHaveTextContent('Q 0.00');
  });

  it('si el contador no tiene recibos lo avisa en lugar de mostrar una tabla vacia', () => {
    vista(datos());

    expect(screen.getByText(/todavía no tiene recibos emitidos/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('no muestra datos sensibles aunque vengan en la respuesta', () => {
    const conExtras = { ...datos(), cliente: { nombreParcial: 'Ana L***', dpi: '1234567890101', telefono: '55555555' } };
    const { container } = vista(conExtras as EstadoCuenta);

    expect(container).not.toHaveTextContent('1234567890101');
    expect(container).not.toHaveTextContent('55555555');
  });

  it('avisa al pulsar "Consultar otro código"', async () => {
    const usuario = userEvent.setup();
    const onNuevaConsulta = vi.fn();
    vista(datos(), onNuevaConsulta);

    await usuario.click(screen.getByRole('button', { name: /consultar otro código/i }));

    expect(onNuevaConsulta).toHaveBeenCalledTimes(1);
  });
});
