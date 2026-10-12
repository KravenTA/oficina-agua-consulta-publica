package gt.edu.miumg.oficinaagua.consulta.ratelimit;

import java.time.Clock;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Limitador de consultas por clave (la IP del cliente) con ventana deslizante.
 *
 * <p>Permite como máximo {@code maximo} consultas dentro de cualquier ventana de
 * {@code ventana}. Las consultas rechazadas NO consumen cupo, así que insistir no alarga
 * el bloqueo. Vive en memoria: con varias instancias del ApiRest cada una llevaría su propia
 * cuenta (para ese caso habría que mover el contador a un almacén compartido, como Redis).
 */
public class RateLimiter {

    /** Resultado de un intento: si pasa, o cuántos segundos debe esperar el cliente. */
    public record Decision(boolean permitido, long reintentarEnSegundos) {
        static Decision pasa() {
            return new Decision(true, 0);
        }
    }

    // Cada cuántas consultas se limpian las IP que ya no tienen actividad.
    private static final long PURGAR_CADA = 1000;

    private final int maximo;
    private final long ventanaMs;
    private final Clock reloj;
    private final ConcurrentHashMap<String, ArrayDeque<Long>> registros = new ConcurrentHashMap<>();
    private final AtomicLong consultas = new AtomicLong();

    public RateLimiter(int maximo, Duration ventana, Clock reloj) {
        if (maximo < 1) {
            throw new IllegalArgumentException("El máximo de consultas debe ser al menos 1");
        }
        if (ventana == null || ventana.toMillis() < 1) {
            throw new IllegalArgumentException("La ventana debe ser de al menos 1 milisegundo");
        }
        this.maximo = maximo;
        this.ventanaMs = ventana.toMillis();
        this.reloj = reloj;
    }

    public Decision intentar(String clave) {
        long ahora = reloj.millis();
        if (consultas.incrementAndGet() % PURGAR_CADA == 0) {
            purgar(ahora);
        }

        Decision[] resultado = new Decision[1];
        // compute() es atómico por clave: dos hilos con la misma IP no pueden colarse.
        registros.compute(clave, (k, existente) -> {
            ArrayDeque<Long> instantes = existente == null ? new ArrayDeque<>() : existente;
            expirar(instantes, ahora);
            if (instantes.size() < maximo) {
                instantes.addLast(ahora);
                resultado[0] = Decision.pasa();
            } else {
                // El cupo se libera cuando sale de la ventana la consulta más antigua.
                long faltanMs = ventanaMs - (ahora - instantes.peekFirst());
                long segundos = Math.max(1, (faltanMs + 999) / 1000);
                resultado[0] = new Decision(false, segundos);
            }
            return instantes;
        });
        return resultado[0];
    }

    /** Elimina las claves sin consultas dentro de la ventana, para que el mapa no crezca sin fin. */
    void purgar(long ahora) {
        for (String clave : registros.keySet()) {
            registros.computeIfPresent(clave, (k, instantes) -> {
                expirar(instantes, ahora);
                return instantes.isEmpty() ? null : instantes;
            });
        }
    }

    int clavesRastreadas() {
        return registros.size();
    }

    private void expirar(ArrayDeque<Long> instantes, long ahora) {
        while (!instantes.isEmpty() && ahora - instantes.peekFirst() >= ventanaMs) {
            instantes.pollFirst();
        }
    }
}
