package gt.edu.miumg.oficinaagua.consulta.ratelimit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class RateLimiterTest {

    private RelojManual reloj;
    private RateLimiter limitador;

    @BeforeEach
    void preparar() {
        reloj = new RelojManual();
        limitador = new RateLimiter(3, Duration.ofSeconds(60), reloj);
    }

    @Test
    void permiteHastaElMaximoYBloqueaLaSiguiente() {
        assertTrue(limitador.intentar("1.1.1.1").permitido());
        assertTrue(limitador.intentar("1.1.1.1").permitido());
        assertTrue(limitador.intentar("1.1.1.1").permitido());

        RateLimiter.Decision cuarta = limitador.intentar("1.1.1.1");

        assertFalse(cuarta.permitido());
        assertEquals(60, cuarta.reintentarEnSegundos());
    }

    @Test
    void retryAfterDisminuyeConElPasoDelTiempo() {
        for (int i = 0; i < 3; i++) {
            limitador.intentar("1.1.1.1");
        }
        reloj.avanzar(Duration.ofSeconds(20));

        assertEquals(40, limitador.intentar("1.1.1.1").reintentarEnSegundos());
    }

    @Test
    void retryAfterSeRedondeaHaciaArribaYNuncaEsCero() {
        for (int i = 0; i < 3; i++) {
            limitador.intentar("1.1.1.1");
        }
        reloj.avanzar(Duration.ofMillis(59_800)); // faltan 200 ms

        assertEquals(1, limitador.intentar("1.1.1.1").reintentarEnSegundos());
    }

    @Test
    void sePuedeConsultarDeNuevoCuandoTerminaLaVentana() {
        for (int i = 0; i < 3; i++) {
            limitador.intentar("1.1.1.1");
        }
        assertFalse(limitador.intentar("1.1.1.1").permitido());

        reloj.avanzar(Duration.ofSeconds(60));

        assertTrue(limitador.intentar("1.1.1.1").permitido());
    }

    @Test
    void insistirNoAlargaElBloqueo() {
        for (int i = 0; i < 3; i++) {
            limitador.intentar("1.1.1.1");
        }
        reloj.avanzar(Duration.ofSeconds(10));
        for (int i = 0; i < 20; i++) {
            assertFalse(limitador.intentar("1.1.1.1").permitido());
        }

        // Pasaron 60 s desde las primeras consultas permitidas: el cupo se libera
        // aunque haya habido muchos intentos rechazados en medio.
        reloj.avanzar(Duration.ofSeconds(50));

        assertTrue(limitador.intentar("1.1.1.1").permitido());
    }

    @Test
    void cadaIpTieneSuPropioCupo() {
        for (int i = 0; i < 3; i++) {
            limitador.intentar("1.1.1.1");
        }
        assertFalse(limitador.intentar("1.1.1.1").permitido());

        assertTrue(limitador.intentar("2.2.2.2").permitido());
    }

    @Test
    void laVentanaEsDeslizanteYNoPorBloques() {
        limitador.intentar("1.1.1.1");              // t = 0
        reloj.avanzar(Duration.ofSeconds(30));
        limitador.intentar("1.1.1.1");              // t = 30
        limitador.intentar("1.1.1.1");              // t = 30
        assertFalse(limitador.intentar("1.1.1.1").permitido());

        reloj.avanzar(Duration.ofSeconds(30));      // t = 60: sale solo la de t = 0

        assertTrue(limitador.intentar("1.1.1.1").permitido());
        assertFalse(limitador.intentar("1.1.1.1").permitido());
    }

    @Test
    void purgarEliminaLasIpSinActividadReciente() {
        limitador.intentar("1.1.1.1");
        limitador.intentar("2.2.2.2");
        assertEquals(2, limitador.clavesRastreadas());

        reloj.avanzar(Duration.ofSeconds(61));
        limitador.purgar(reloj.millis());

        assertEquals(0, limitador.clavesRastreadas());
    }

    @Test
    void conVariosHilosDeLaMismaIpSoloPasaElMaximo() throws Exception {
        RateLimiter concurrente = new RateLimiter(10, Duration.ofSeconds(60), reloj);
        int hilos = 50;
        ExecutorService pool = Executors.newFixedThreadPool(hilos);
        CountDownLatch salida = new CountDownLatch(1);
        List<Future<Boolean>> resultados = new ArrayList<>();
        for (int i = 0; i < 200; i++) {
            Callable<Boolean> tarea = () -> {
                salida.await();
                return concurrente.intentar("9.9.9.9").permitido();
            };
            resultados.add(pool.submit(tarea));
        }
        salida.countDown();

        int permitidas = 0;
        for (Future<Boolean> resultado : resultados) {
            if (resultado.get(10, TimeUnit.SECONDS)) {
                permitidas++;
            }
        }
        pool.shutdownNow();

        assertEquals(10, permitidas);
    }

    @Test
    void rechazaConfiguracionInvalida() {
        assertThrows(IllegalArgumentException.class,
                () -> new RateLimiter(0, Duration.ofSeconds(60), reloj));
        assertThrows(IllegalArgumentException.class,
                () -> new RateLimiter(10, Duration.ZERO, reloj));
    }
}
