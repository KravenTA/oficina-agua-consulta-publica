/** Forma de la respuesta 200 del ApiRest (ver api/openapi/consulta-api.yaml, esquema EstadoCuenta). */
export type EstadoRecibo = 'PENDIENTE' | 'VENCIDO' | 'PAGADO';

export type Recibo = {
  numero: string;
  periodo: { anio: number; mes: number };
  fechaEmision: string;
  fechaVencimiento?: string | null;
  consumoM3?: number | null;
  total: number;
  estado: EstadoRecibo;
};

export type EstadoCuenta = {
  contador: { numeroSerie: string; tipoServicio?: string | null };
  cliente: { nombreParcial: string };
  recibos: Recibo[];
  resumen: {
    totalEmitido: number;
    totalPagado: number;
    totalPendiente: number;
    recibosPendientes: number;
    recibosVencidos: number;
  };
  consultadoEn?: string;
};

const ESTADOS: readonly string[] = ['PENDIENTE', 'VENCIDO', 'PAGADO'];

function esNumero(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor);
}

function esRecibo(valor: unknown): valor is Recibo {
  const r = valor as Partial<Recibo> | null;
  return (
    typeof r === 'object' &&
    r !== null &&
    typeof r.numero === 'string' &&
    typeof r.periodo === 'object' &&
    r.periodo !== null &&
    esNumero(r.periodo.anio) &&
    esNumero(r.periodo.mes) &&
    esNumero(r.total) &&
    typeof r.estado === 'string' &&
    ESTADOS.includes(r.estado)
  );
}

/** Comprueba que lo recibido del servidor tenga la forma esperada antes de pintarlo. */
export function esEstadoCuenta(valor: unknown): valor is EstadoCuenta {
  const e = valor as Partial<EstadoCuenta> | null;
  if (typeof e !== 'object' || e === null) return false;
  return (
    typeof e.contador?.numeroSerie === 'string' &&
    typeof e.cliente?.nombreParcial === 'string' &&
    Array.isArray(e.recibos) &&
    e.recibos.every(esRecibo) &&
    esNumero(e.resumen?.totalPendiente) &&
    esNumero(e.resumen?.totalPagado) &&
    esNumero(e.resumen?.totalEmitido) &&
    esNumero(e.resumen?.recibosPendientes) &&
    esNumero(e.resumen?.recibosVencidos)
  );
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** 45 -> "Q 45.00". Siempre en quetzales y con 2 decimales, sin depender del idioma del navegador. */
export function formatearMonto(valor: number): string {
  const [entero, decimales] = Math.abs(valor).toFixed(2).split('.');
  const conMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${valor < 0 ? '-' : ''}Q ${conMiles}.${decimales}`;
}

/** { anio: 2026, mes: 9 } -> "Septiembre 2026". */
export function formatearPeriodo(periodo: { anio: number; mes: number }): string {
  const mes = MESES[periodo.mes - 1];
  return mes ? `${mes} ${periodo.anio}` : `${periodo.mes}/${periodo.anio}`;
}

/** "2026-09-30" -> "30/09/2026". Se parte el texto a mano para que la zona horaria no mueva el dia. */
export function formatearFecha(iso: string | null | undefined): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : '';
}
