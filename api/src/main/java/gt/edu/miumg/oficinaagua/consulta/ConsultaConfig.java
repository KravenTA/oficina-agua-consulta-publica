package gt.edu.miumg.oficinaagua.consulta;

import java.time.Clock;
import java.time.ZoneId;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ConsultaConfig {

    /**
     * Reloj de la aplicación. Se usa la zona de Guatemala porque el contenedor corre en UTC
     * y, sin esto, a partir de las 18:00 hora local "hoy" ya sería el día siguiente y un
     * recibo aparecería vencido un día antes.
     */
    @Bean
    public Clock reloj(@Value("${consulta.zona-horaria:America/Guatemala}") String zona) {
        return Clock.system(ZoneId.of(zona));
    }
}
