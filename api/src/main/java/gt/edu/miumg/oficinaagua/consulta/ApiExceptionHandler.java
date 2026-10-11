package gt.edu.miumg.oficinaagua.consulta;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import jakarta.validation.ConstraintViolationException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

import gt.edu.miumg.oficinaagua.consulta.api.model.CodigoError;
import gt.edu.miumg.oficinaagua.consulta.api.model.ErrorRespuesta;

/** Traduce las excepciones al formato único de error del contrato. Nunca expone detalles internos. */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler({SerieInvalidaException.class, ConstraintViolationException.class,
            HandlerMethodValidationException.class})
    public ResponseEntity<ErrorRespuesta> serieInvalida(Exception ex) {
        return error(HttpStatus.BAD_REQUEST, CodigoError.SERIE_INVALIDA,
                "El número de serie solo puede contener letras, números y guiones (3 a 30 caracteres).");
    }

    @ExceptionHandler(ContadorNoEncontradoException.class)
    public ResponseEntity<ErrorRespuesta> noEncontrado(ContadorNoEncontradoException ex) {
        return error(HttpStatus.NOT_FOUND, CodigoError.CONTADOR_NO_ENCONTRADO,
                "No se encontró un contador con ese número de serie.");
    }

    @ExceptionHandler(DataAccessResourceFailureException.class)
    public ResponseEntity<ErrorRespuesta> baseNoDisponible(DataAccessResourceFailureException ex) {
        log.error("La réplica MySQL no está disponible", ex);
        return error(HttpStatus.SERVICE_UNAVAILABLE, CodigoError.SERVICIO_NO_DISPONIBLE,
                "El servicio de consulta no está disponible por el momento.");
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ErrorRespuesta> inesperado(RuntimeException ex) {
        log.error("Error inesperado en la consulta", ex);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, CodigoError.ERROR_INTERNO,
                "No se pudo completar la consulta. Intente más tarde.");
    }

    private ResponseEntity<ErrorRespuesta> error(HttpStatus estado, CodigoError codigo, String mensaje) {
        ErrorRespuesta cuerpo = new ErrorRespuesta();
        cuerpo.setCodigo(codigo);
        cuerpo.setMensaje(mensaje);
        cuerpo.setFecha(OffsetDateTime.now(ZoneOffset.UTC));
        return ResponseEntity.status(estado).contentType(MediaType.APPLICATION_JSON).body(cuerpo);
    }
}
