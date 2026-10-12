package gt.edu.miumg.oficinaagua.consulta.ratelimit;

import java.time.Clock;
import java.time.Duration;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

@Configuration
@EnableConfigurationProperties(RateLimitProperties.class)
public class RateLimitConfig {

    @Bean
    public RateLimiter rateLimiter(RateLimitProperties propiedades, Clock reloj) {
        return new RateLimiter(propiedades.getMaxRequests(),
                Duration.ofSeconds(propiedades.getWindowSeconds()), reloj);
    }

    /** El filtro solo protege la API (/api/*): Swagger UI y el contrato quedan libres. */
    @Bean
    public FilterRegistrationBean<RateLimitFilter> rateLimitFilter(RateLimiter limitador,
                                                                   RateLimitProperties propiedades,
                                                                   ObjectMapper mapper) {
        FilterRegistrationBean<RateLimitFilter> registro = new FilterRegistrationBean<>(
                new RateLimitFilter(limitador, propiedades.isTrustForwardedFor(), mapper));
        registro.addUrlPatterns("/api/*");
        registro.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return registro;
    }
}
