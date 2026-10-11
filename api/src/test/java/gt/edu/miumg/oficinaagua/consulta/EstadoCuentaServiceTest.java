package gt.edu.miumg.oficinaagua.consulta;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import gt.edu.miumg.oficinaagua.consulta.EstadoCuentaRepository.ContadorCliente;
import gt.edu.miumg.oficinaagua.consulta.EstadoCuentaRepository.ReciboFila;
import gt.edu.miumg.oficinaagua.consulta.api.model.EstadoCuenta;
import gt.edu.miumg.oficinaagua.consulta.api.model.EstadoRecibo;
import gt.edu.miumg.oficinaagua.consulta.api.model.Resumen;

@ExtendWith(MockitoExtension.class)
class EstadoCuentaServiceTest {

    private static final ZoneId GUATEMALA = ZoneId.of("America/Guatemala");

    @Mock
    private EstadoCuentaRepository repositorio;

    private EstadoCuentaService servicioEn(String instanteUtc) {
        Clock reloj = Clock.fixed(Instant.parse(instanteUtc), GUATEMALA);
        return new EstadoCuentaService(repositorio, reloj);
    }

    private static ContadorCliente contador() {
        return new ContadorCliente("CTR-0001", "media_paja", "Ana Lucia Moran");
    }

    private static ReciboFila recibo(String numero, int mes, String vencimiento, String total, String estado) {
        return new ReciboFila(numero, 2026, mes, LocalDate.of(2026, mes, 1),
                vencimiento == null ? null : LocalDate.parse(vencimiento),
                new BigDecimal("10.00"), new BigDecimal(total), estado);
    }

    private static void assertMonto(String esperado, BigDecimal real) {
        assertEquals(0, new BigDecimal(esperado).compareTo(real), "esperado " + esperado + " pero fue " + real);
    }

    @Test
    void lanzaNoEncontradoSiElContadorNoExiste() {
        when(repositorio.buscarContador("CTR-9999")).thenReturn(Optional.empty());

        assertThrows(ContadorNoEncontradoException.class,
                () -> servicioEn("2026-10-10T12:00:00Z").obtener("CTR-9999"));
    }

    @Test
    void calculaEstadosYResumen() {
        when(repositorio.buscarContador("CTR-0001")).thenReturn(Optional.of(contador()));
        when(repositorio.listarRecibos("CTR-0001")).thenReturn(List.of(
                recibo("R-3", 10, "2026-10-20", "30.00", "pendiente"),   // aun en plazo
                recibo("R-2", 9, "2026-09-16", "45.00", "pendiente"),    // ya paso su fecha
                recibo("R-1", 8, "2026-08-16", "60.00", "pagado")));

        EstadoCuenta resultado = servicioEn("2026-10-10T12:00:00Z").obtener("CTR-0001");

        assertEquals("CTR-0001", resultado.getContador().getNumeroSerie());
        assertEquals("Ana L*** M***", resultado.getCliente().getNombreParcial());
        assertEquals(3, resultado.getRecibos().size());
        assertEquals(EstadoRecibo.PENDIENTE, resultado.getRecibos().get(0).getEstado());
        assertEquals(EstadoRecibo.VENCIDO, resultado.getRecibos().get(1).getEstado());
        assertEquals(EstadoRecibo.PAGADO, resultado.getRecibos().get(2).getEstado());

        Resumen resumen = resultado.getResumen();
        assertMonto("135.00", resumen.getTotalEmitido());
        assertMonto("60.00", resumen.getTotalPagado());
        assertMonto("75.00", resumen.getTotalPendiente());
        assertEquals(1, resumen.getRecibosPendientes());
        assertEquals(1, resumen.getRecibosVencidos());
    }

    @Test
    void sinRecibosElResumenQuedaEnCero() {
        when(repositorio.buscarContador("CTR-0001")).thenReturn(Optional.of(contador()));
        when(repositorio.listarRecibos("CTR-0001")).thenReturn(List.of());

        EstadoCuenta resultado = servicioEn("2026-10-10T12:00:00Z").obtener("CTR-0001");

        assertEquals(0, resultado.getRecibos().size());
        assertMonto("0.00", resultado.getResumen().getTotalEmitido());
        assertMonto("0.00", resultado.getResumen().getTotalPendiente());
    }

    @Test
    void unReciboQueVenceHoyTodaviaNoEstaVencido() {
        assertEquals(EstadoRecibo.PENDIENTE,
                EstadoCuentaService.derivarEstado("pendiente", LocalDate.of(2026, 10, 10), LocalDate.of(2026, 10, 10)));
    }

    @Test
    void unReciboPendienteSinFechaDeVencimientoSigueComoPendiente() {
        assertEquals(EstadoRecibo.PENDIENTE,
                EstadoCuentaService.derivarEstado("pendiente", null, LocalDate.of(2026, 10, 10)));
    }

    @Test
    void unReciboPagadoNuncaSeMuestraComoVencido() {
        assertEquals(EstadoRecibo.PAGADO,
                EstadoCuentaService.derivarEstado("pagado", LocalDate.of(2020, 1, 1), LocalDate.of(2026, 10, 10)));
    }

    @Test
    void usaLaFechaDeGuatemalaYNoLaDeUtc() {
        // 2026-10-11 03:00 UTC son las 21:00 del 10 de octubre en Guatemala.
        // El recibo vence el 10: aun no esta vencido, aunque en UTC ya sea dia 11.
        when(repositorio.buscarContador("CTR-0001")).thenReturn(Optional.of(contador()));
        when(repositorio.listarRecibos("CTR-0001")).thenReturn(List.of(
                recibo("R-1", 10, "2026-10-10", "30.00", "pendiente")));

        EstadoCuenta resultado = servicioEn("2026-10-11T03:00:00Z").obtener("CTR-0001");

        assertEquals(EstadoRecibo.PENDIENTE, resultado.getRecibos().get(0).getEstado());
    }

    @Test
    void unEstadoDesconocidoEsUnErrorInterno() {
        assertThrows(IllegalStateException.class,
                () -> EstadoCuentaService.derivarEstado("raro", null, LocalDate.of(2026, 10, 10)));
    }
}
