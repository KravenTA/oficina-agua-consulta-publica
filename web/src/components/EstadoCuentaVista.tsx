import {
  formatearFecha,
  formatearMonto,
  formatearPeriodo,
  type EstadoCuenta,
  type EstadoRecibo,
} from '@/lib/estado-cuenta';

type Props = {
  datos: EstadoCuenta;
  /** Se llama al pulsar "Consultar otro código". */
  onNuevaConsulta: () => void;
};

const ETIQUETA: Record<EstadoRecibo, string> = {
  PENDIENTE: 'Pendiente',
  VENCIDO: 'Vencido',
  PAGADO: 'Pagado',
};

/** Muestra el estado de cuenta devuelto por la consulta. Solo presentacion: no pide nada al servidor. */
export function EstadoCuentaVista({ datos, onNuevaConsulta }: Props) {
  const { cliente, contador, recibos, resumen } = datos;
  const debe = resumen.totalPendiente > 0;

  return (
    <section className="estado-cuenta" aria-labelledby="titulo-estado-cuenta">
      <h2 id="titulo-estado-cuenta">Estado de cuenta</h2>
      <p className="estado-cuenta__cliente">
        <span className="estado-cuenta__nombre">{cliente.nombreParcial}</span>
        <span className="estado-cuenta__contador">Contador {contador.numeroSerie}</span>
      </p>

      <div
        className={`estado-cuenta__resumen ${debe ? 'estado-cuenta__resumen--debe' : 'estado-cuenta__resumen--al-dia'}`}
        role="status"
      >
        <span className="estado-cuenta__resumen-etiqueta">{debe ? 'Total pendiente de pago' : 'Estás al día'}</span>
        <strong className="estado-cuenta__resumen-monto">{formatearMonto(resumen.totalPendiente)}</strong>
        {debe && (
          <span className="estado-cuenta__resumen-detalle">
            {resumen.recibosVencidos > 0
              ? `${textoRecibos(resumen.recibosVencidos, 'vencido')}${
                  resumen.recibosPendientes > 0 ? ` y ${textoRecibos(resumen.recibosPendientes, 'pendiente')}` : ''
                }`
              : textoRecibos(resumen.recibosPendientes, 'pendiente')}
          </span>
        )}
      </div>

      {recibos.length === 0 ? (
        <p className="mensaje mensaje--info">Este contador todavía no tiene recibos emitidos.</p>
      ) : (
        <div className="estado-cuenta__tabla-contenedor">
          <table className="estado-cuenta__tabla">
            <caption className="solo-lectores">Recibos del contador {contador.numeroSerie}</caption>
            <thead>
              <tr>
                <th scope="col">Recibo</th>
                <th scope="col">Período</th>
                <th scope="col" className="numerico">Monto</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {recibos.map((recibo) => (
                <tr
                  key={recibo.numero}
                  className={recibo.estado === 'VENCIDO' ? 'recibo recibo--vencido' : 'recibo'}
                >
                  <td data-etiqueta="Recibo">{recibo.numero}</td>
                  <td data-etiqueta="Período">{formatearPeriodo(recibo.periodo)}</td>
                  <td data-etiqueta="Monto" className="numerico">{formatearMonto(recibo.total)}</td>
                  <td data-etiqueta="Estado">
                    <span className={`etiqueta etiqueta--${recibo.estado.toLowerCase()}`}>
                      {ETIQUETA[recibo.estado]}
                    </span>
                    {recibo.estado === 'VENCIDO' && recibo.fechaVencimiento && (
                      <span className="recibo__vencio">Venció el {formatearFecha(recibo.fechaVencimiento)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button type="button" className="boton boton--secundario" onClick={onNuevaConsulta}>
        Consultar otro código
      </button>
    </section>
  );
}

function textoRecibos(cantidad: number, estado: 'vencido' | 'pendiente'): string {
  return `${cantidad} ${cantidad === 1 ? 'recibo' : 'recibos'} ${estado}${cantidad === 1 ? '' : 's'}`;
}
