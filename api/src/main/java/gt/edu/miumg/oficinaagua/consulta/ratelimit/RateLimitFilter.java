package gt.edu.miumg.oficinaagua.consulta.ratelimit;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import gt.edu.miumg.oficinaagua.consulta.api.model.CodigoError;
import gt.edu.miumg.oficinaagua.consulta.api.model.ErrorRespuesta;

/**
 * Corta con 429 las consultas de una IP que superó su límite.
 *
 * <p>Actúa ANTES del controlador y no sabe nada del captcha: es una segunda barrera
 * independiente, para frenar el scraping aunque el captcha sea evadido. Cuentan todas las
 * consultas, incluidas las que terminan en 404 (así se frena también el recorrido de
 * números de serie adivinando).
 */
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);

    private final RateLimiter limitador;
    private final boolean confiarEnForwardedFor;
    private final ObjectMapper mapper;

    public RateLimitFilter(RateLimiter limitador, boolean confiarEnForwardedFor, ObjectMapper mapper) {
        this.limitador = limitador;
        this.confiarEnForwardedFor = confiarEnForwardedFor;
        this.mapper = mapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain cadena) throws ServletException, IOException {
        String ip = IpCliente.resolver(request.getRemoteAddr(), request.getHeader("X-Forwarded-For"),
                confiarEnForwardedFor);
        RateLimiter.Decision decision = limitador.intentar(ip);

        if (decision.permitido()) {
            cadena.doFilter(request, response);
            return;
        }

        log.warn("Límite de consultas excedido para la IP {} (reintentar en {} s)", ip,
                decision.reintentarEnSegundos());

        ErrorRespuesta cuerpo = new ErrorRespuesta();
        cuerpo.setCodigo(CodigoError.LIMITE_EXCEDIDO);
        cuerpo.setMensaje("Demasiadas consultas. Intente de nuevo en unos segundos.");
        cuerpo.setFecha(OffsetDateTime.now(ZoneOffset.UTC));

        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader(HttpHeaders.RETRY_AFTER, String.valueOf(decision.reintentarEnSegundos()));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        mapper.writeValue(response.getOutputStream(), cuerpo);
    }
}
