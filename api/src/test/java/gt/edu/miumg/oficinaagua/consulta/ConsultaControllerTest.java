package gt.edu.miumg.oficinaagua.consulta;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.test.web.servlet.MockMvc;

import gt.edu.miumg.oficinaagua.consulta.api.model.Cliente;
import gt.edu.miumg.oficinaagua.consulta.api.model.Contador;
import gt.edu.miumg.oficinaagua.consulta.api.model.EstadoCuenta;
import gt.edu.miumg.oficinaagua.consulta.api.model.EstadoRecibo;
import gt.edu.miumg.oficinaagua.consulta.api.model.Periodo;
import gt.edu.miumg.oficinaagua.consulta.api.model.Recibo;
import gt.edu.miumg.oficinaagua.consulta.api.model.Resumen;

@WebMvcTest(ConsultaController.class)
class ConsultaControllerTest {

    private static final String RUTA = "/api/v1/consulta/contadores/{serie}/estado-cuenta";

    @Autowired
    private MockMvc mvc;

    @MockBean
    private EstadoCuentaService servicio;

    private static EstadoCuenta estadoCuentaDeEjemplo() {
        Contador contador = new Contador();
        contador.setNumeroSerie("CTR-0001");

        Cliente cliente = new Cliente();
        cliente.setNombreParcial("Ana L*** M***");

        Periodo periodo = new Periodo();
        periodo.setAnio(2026);
        periodo.setMes(9);

        Recibo recibo = new Recibo();
        recibo.setNumero("R-0001");
        recibo.setPeriodo(periodo);
        recibo.setFechaEmision(LocalDate.of(2026, 9, 1));
        recibo.setFechaVencimiento(LocalDate.of(2026, 9, 16));
        recibo.setTotal(new BigDecimal("45.00"));
        recibo.setEstado(EstadoRecibo.VENCIDO);

        Resumen resumen = new Resumen();
        resumen.setTotalEmitido(new BigDecimal("45.00"));
        resumen.setTotalPagado(new BigDecimal("0.00"));
        resumen.setTotalPendiente(new BigDecimal("45.00"));
        resumen.setRecibosPendientes(0);
        resumen.setRecibosVencidos(1);

        EstadoCuenta estadoCuenta = new EstadoCuenta();
        estadoCuenta.setContador(contador);
        estadoCuenta.setCliente(cliente);
        estadoCuenta.setRecibos(List.of(recibo));
        estadoCuenta.setResumen(resumen);
        return estadoCuenta;
    }

    @Test
    void devuelve200ConElEstadoDeCuenta() throws Exception {
        when(servicio.obtener("CTR-0001")).thenReturn(estadoCuentaDeEjemplo());

        mvc.perform(get(RUTA, "CTR-0001"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.contador.numeroSerie").value("CTR-0001"))
                .andExpect(jsonPath("$.cliente.nombreParcial").value("Ana L*** M***"))
                .andExpect(jsonPath("$.recibos[0].estado").value("VENCIDO"))
                .andExpect(jsonPath("$.resumen.totalPendiente").value(45.00));
    }

    @Test
    void laRespuestaNoIncluyeDatosSensibles() throws Exception {
        when(servicio.obtener("CTR-0001")).thenReturn(estadoCuentaDeEjemplo());

        mvc.perform(get(RUTA, "CTR-0001"))
                .andExpect(status().isOk())
                .andExpect(content().string(not(containsString("dpi"))))
                .andExpect(content().string(not(containsString("nit"))))
                .andExpect(content().string(not(containsString("telefono"))))
                .andExpect(content().string(not(containsString("email"))))
                .andExpect(content().string(not(containsString("direccion"))));
    }

    @Test
    void devuelve404SiElContadorNoExiste() throws Exception {
        when(servicio.obtener("CTR-0404")).thenThrow(new ContadorNoEncontradoException("CTR-0404"));

        mvc.perform(get(RUTA, "CTR-0404"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.codigo").value("CONTADOR_NO_ENCONTRADO"))
                .andExpect(jsonPath("$.mensaje").exists())
                .andExpect(jsonPath("$.fecha").exists());
    }

    @Test
    void devuelve400SiLaSerieEsMuyCorta() throws Exception {
        mvc.perform(get(RUTA, "AB"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("SERIE_INVALIDA"));
    }

    @Test
    void devuelve400SiLaSerieTieneCaracteresNoPermitidos() throws Exception {
        mvc.perform(get(RUTA, "CTR_0001"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("SERIE_INVALIDA"));
    }

    @Test
    void devuelve503SinDetallesSiLaReplicaNoEstaDisponible() throws Exception {
        when(servicio.obtener("CTR-0001"))
                .thenThrow(new DataAccessResourceFailureException("host mysql-replica caido, clave incorrecta"));

        mvc.perform(get(RUTA, "CTR-0001"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.codigo").value("SERVICIO_NO_DISPONIBLE"))
                .andExpect(content().string(not(containsString("mysql-replica"))));
    }

    @Test
    void devuelve500SinDetallesInternos() throws Exception {
        when(servicio.obtener("CTR-0001")).thenThrow(new IllegalStateException("detalle interno secreto"));

        mvc.perform(get(RUTA, "CTR-0001"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.codigo").value("ERROR_INTERNO"))
                .andExpect(content().string(not(containsString("secreto"))));
    }
}
