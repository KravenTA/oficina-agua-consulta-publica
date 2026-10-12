package gt.edu.miumg.oficinaagua.consulta.ratelimit;

import jakarta.validation.constraints.Min;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Configuración del rate limit. Si un valor es inválido, la aplicación no arranca. */
@ConfigurationProperties(prefix = "consulta.rate-limit")
@Validated
public class RateLimitProperties {

    /** Consultas permitidas por IP dentro de la ventana (RATE_LIMIT_MAX_REQUESTS). */
    @Min(1)
    private int maxRequests = 10;

    /** Tamaño de la ventana en segundos (RATE_LIMIT_WINDOW_SECONDS). */
    @Min(1)
    private long windowSeconds = 60;

    /** Leer la IP del cliente desde X-Forwarded-For (RATE_LIMIT_TRUST_FORWARDED_FOR). */
    private boolean trustForwardedFor = false;

    public int getMaxRequests() {
        return maxRequests;
    }

    public void setMaxRequests(int maxRequests) {
        this.maxRequests = maxRequests;
    }

    public long getWindowSeconds() {
        return windowSeconds;
    }

    public void setWindowSeconds(long windowSeconds) {
        this.windowSeconds = windowSeconds;
    }

    public boolean isTrustForwardedFor() {
        return trustForwardedFor;
    }

    public void setTrustForwardedFor(boolean trustForwardedFor) {
        this.trustForwardedFor = trustForwardedFor;
    }
}
