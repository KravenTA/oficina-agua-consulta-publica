package gt.edu.miumg.oficinaagua.consulta;

import java.util.regex.Pattern;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import gt.edu.miumg.oficinaagua.consulta.api.ConsultaApi;
import gt.edu.miumg.oficinaagua.consulta.api.model.EstadoCuenta;

/** Implementa la interfaz generada a partir del contrato OpenAPI. */
@RestController
public class ConsultaController implements ConsultaApi {

    // Misma regla que el contrato: 3 a 30 letras, números o guiones.
    private static final Pattern SERIE_VALIDA = Pattern.compile("^[A-Za-z0-9-]{3,30}$");

    private final EstadoCuentaService servicio;

    public ConsultaController(EstadoCuentaService servicio) {
        this.servicio = servicio;
    }

    @Override
    public ResponseEntity<EstadoCuenta> obtenerEstadoCuenta(String numeroSerie) {
        if (numeroSerie == null || !SERIE_VALIDA.matcher(numeroSerie).matches()) {
            throw new SerieInvalidaException();
        }
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(servicio.obtener(numeroSerie));
    }
}
