package gt.edu.miumg.oficinaagua.consulta.ratelimit;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

/** Reloj de pruebas: el tiempo solo avanza cuando la prueba lo indica. */
class RelojManual extends Clock {

    private long milisegundos = 1_000_000L;

    void avanzar(Duration duracion) {
        milisegundos += duracion.toMillis();
    }

    @Override
    public ZoneId getZone() {
        return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(ZoneId zona) {
        return this;
    }

    @Override
    public Instant instant() {
        return Instant.ofEpochMilli(milisegundos);
    }

    @Override
    public long millis() {
        return milisegundos;
    }
}
