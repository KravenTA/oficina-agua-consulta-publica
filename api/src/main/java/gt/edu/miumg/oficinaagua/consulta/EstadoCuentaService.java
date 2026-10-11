package gt.edu.miumg.oficinaagua.consulta;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import gt.edu.miumg.oficinaagua.consulta.EstadoCuentaRepository.ContadorCliente;
import gt.edu.miumg.oficinaagua.consulta.EstadoCuentaRepository.ReciboFila;
import gt.edu.miumg.oficinaagua.consulta.api.model.Cliente;
import gt.edu.miumg.oficinaagua.consulta.api.model.Contador;
import gt.edu.miumg.oficinaagua.consulta.api.model.EstadoCuenta;
import gt.edu.miumg.oficinaagua.consulta.api.model.EstadoRecibo;
import gt.edu.miumg.oficinaagua.consulta.api.model.Periodo;
import gt.edu.miumg.oficinaagua.consulta.api.model.Recibo;
import gt.edu.miumg.oficinaagua.consulta.api.model.Resumen;

@Service
public class EstadoCuentaService {

    private final EstadoCuentaRepository repositorio;
    private final Clock reloj;

    public EstadoCuentaService(EstadoCuentaRepository repositorio, Clock reloj) {
        this.repositorio = repositorio;
        this.reloj = reloj;
    }

    public EstadoCuenta obtener(String numeroSerie) {
        ContadorCliente datos = repositorio.buscarContador(numeroSerie)
                .orElseThrow(() -> new ContadorNoEncontradoException(numeroSerie));

        LocalDate hoy = LocalDate.now(reloj);
        List<Recibo> recibos = new ArrayList<>();
        for (ReciboFila fila : repositorio.listarRecibos(numeroSerie)) {
            recibos.add(aRecibo(fila, hoy));
        }

        Contador contador = new Contador();
        contador.setNumeroSerie(datos.numeroSerie());
        contador.setTipoServicio(datos.tipoServicio());

        Cliente cliente = new Cliente();
        cliente.setNombreParcial(NombreParcial.enmascarar(datos.nombreCliente()));

        EstadoCuenta estadoCuenta = new EstadoCuenta();
        estadoCuenta.setContador(contador);
        estadoCuenta.setCliente(cliente);
        estadoCuenta.setRecibos(recibos);
        estadoCuenta.setResumen(calcularResumen(recibos));
        estadoCuenta.setConsultadoEn(OffsetDateTime.now(reloj));
        return estadoCuenta;
    }

    /**
     * El monolito nunca marca un recibo como "vencido": lo deja "pendiente" con su fecha de
     * vencimiento. Aquí se calcula: pendiente con fecha anterior a hoy => VENCIDO.
     * Si vence hoy, todavía está dentro del plazo.
     */
    static EstadoRecibo derivarEstado(String estadoBd, LocalDate vencimiento, LocalDate hoy) {
        String estado = estadoBd == null ? "" : estadoBd.toLowerCase();
        return switch (estado) {
            case "pagado" -> EstadoRecibo.PAGADO;
            case "vencido" -> EstadoRecibo.VENCIDO;
            case "pendiente" -> (vencimiento != null && vencimiento.isBefore(hoy))
                    ? EstadoRecibo.VENCIDO
                    : EstadoRecibo.PENDIENTE;
            default -> throw new IllegalStateException("Estado de recibo desconocido: " + estadoBd);
        };
    }

    private Recibo aRecibo(ReciboFila fila, LocalDate hoy) {
        Periodo periodo = new Periodo();
        periodo.setAnio(fila.anio());
        periodo.setMes(fila.mes());

        Recibo recibo = new Recibo();
        recibo.setNumero(fila.numero());
        recibo.setPeriodo(periodo);
        recibo.setFechaEmision(fila.fechaEmision());
        recibo.setFechaVencimiento(fila.fechaVencimiento());
        recibo.setConsumoM3(fila.consumoM3());
        recibo.setTotal(fila.total());
        recibo.setEstado(derivarEstado(fila.estado(), fila.fechaVencimiento(), hoy));
        return recibo;
    }

    private Resumen calcularResumen(List<Recibo> recibos) {
        BigDecimal emitido = BigDecimal.ZERO.setScale(2);
        BigDecimal pagado = BigDecimal.ZERO.setScale(2);
        BigDecimal pendiente = BigDecimal.ZERO.setScale(2);
        int cantidadPendientes = 0;
        int cantidadVencidos = 0;

        for (Recibo recibo : recibos) {
            BigDecimal total = recibo.getTotal();
            emitido = emitido.add(total);
            switch (recibo.getEstado()) {
                case PAGADO -> pagado = pagado.add(total);
                case PENDIENTE -> {
                    pendiente = pendiente.add(total);
                    cantidadPendientes++;
                }
                case VENCIDO -> {
                    pendiente = pendiente.add(total);
                    cantidadVencidos++;
                }
            }
        }

        Resumen resumen = new Resumen();
        resumen.setTotalEmitido(emitido);
        resumen.setTotalPagado(pagado);
        resumen.setTotalPendiente(pendiente);
        resumen.setRecibosPendientes(cantidadPendientes);
        resumen.setRecibosVencidos(cantidadVencidos);
        return resumen;
    }
}
