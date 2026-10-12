package gt.edu.miumg.oficinaagua.consulta.ratelimit;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.lenient;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import gt.edu.miumg.oficinaagua.consulta.ApiExceptionHandler;
import gt.edu.miumg.oficinaagua.consulta.ConsultaController;
import gt.edu.miumg.oficinaagua.consulta.ContadorNoEncontradoException;
import gt.edu.miumg.oficinaagua.consulta.EstadoCuentaService;
import gt.edu.miumg.oficinaagua.consulta.api.model.EstadoCuenta;

/** El filtro se prueba delante del controlador real, con un límite de 3 consultas por minuto. */
@ExtendWith(MockitoExtension.class)
class RateLimitFilterTest {

    private static final String RUTA = "/api/v1/consulta/contadores/{serie}/estado-cuenta";

    @Mock
    private EstadoCuentaService servicio;

    private RelojManual reloj;
    private MockMvc mvc;

    @BeforeEach
    void preparar() {
        // Por defecto el contador no existe (404): sirve para comprobar que esas consultas
        // también consumen cupo.
        lenient().when(servicio.obtener(anyString()))
                .thenThrow(new ContadorNoEncontradoException("CTR-9999"));

        reloj = new RelojManual();
        RateLimiter limitador = new RateLimiter(3, Duration.ofSeconds(60), reloj);
        RateLimitFilter filtro = new RateLimitFilter(limitador, true,
                new ObjectMapper().findAndRegisterModules());

        mvc = MockMvcBuilders.standaloneSetup(new ConsultaController(servicio))
                .setControllerAdvice(new ApiExceptionHandler())
                .addFilter(filtro, "/api/*")
                .build();
    }

    private ResultActions consultar(String ip) throws Exception {
        return mvc.perform(get(RUTA, "CTR-9999").header("X-Forwarded-For", ip));
    }

    @Test
    void alSuperarElLimiteResponde429ConRetryAfter() throws Exception {
        for (int i = 0; i < 3; i++) {
            consultar("203.0.113.7").andExpect(status().isNotFound());
        }

        consultar("203.0.113.7")
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "60"))
                .andExpect(jsonPath("$.codigo").value("LIMITE_EXCEDIDO"))
                .andExpect(jsonPath("$.mensaje").exists())
                .andExpect(jsonPath("$.fecha").exists());
    }

    @Test
    void lasConsultasQueTerminanEn404TambienConsumenCupo() throws Exception {
        // Recorrer números de serie al azar es justo lo que se quiere frenar.
        for (int i = 0; i < 3; i++) {
            consultar("203.0.113.7").andExpect(status().isNotFound());
        }
        consultar("203.0.113.7").andExpect(status().isTooManyRequests());
    }

    @Test
    void retryAfterBajaConElTiempoYElCupoVuelveAlTerminarLaVentana() throws Exception {
        for (int i = 0; i < 3; i++) {
            consultar("203.0.113.7");
        }
        reloj.avanzar(Duration.ofSeconds(20));
        consultar("203.0.113.7").andExpect(header().string("Retry-After", "40"));

        reloj.avanzar(Duration.ofSeconds(40));
        consultar("203.0.113.7").andExpect(status().isNotFound());
    }

    @Test
    void cadaIpDelClienteTieneSuPropioCupo() throws Exception {
        for (int i = 0; i < 4; i++) {
            consultar("203.0.113.7");
        }
        consultar("203.0.113.7").andExpect(status().isTooManyRequests());

        consultar("198.51.100.20").andExpect(status().isNotFound());
    }

    @Test
    void elLimiteNoDependeDelCaptcha() throws Exception {
        // El ApiRest no sabe nada del captcha: con o sin token, las consultas cuentan igual.
        for (int i = 0; i < 3; i++) {
            mvc.perform(get(RUTA, "CTR-9999")
                    .header("X-Forwarded-For", "203.0.113.7")
                    .header("X-Captcha-Token", "token-valido"));
        }

        consultar("203.0.113.7").andExpect(status().isTooManyRequests());
    }

    @Test
    void lasConsultasPermitidasLlegaranAlControlador() throws Exception {
        // doReturn(...).when(...) no llama al metodo mientras se configura. Con when(servicio.obtener(...))
        // se ejecutaria el stub general de preparar(), que lanza ContadorNoEncontradoException.
        doReturn(new EstadoCuenta()).when(servicio).obtener("CTR-0001");

        mvc.perform(get(RUTA, "CTR-0001").header("X-Forwarded-For", "203.0.113.7"))
                .andExpect(status().isOk());
    }
}
