package gt.edu.miumg.oficinaagua.consulta;

/** No existe un contador activo con ese número de serie. */
public class ContadorNoEncontradoException extends RuntimeException {

    public ContadorNoEncontradoException(String numeroSerie) {
        super("Contador no encontrado: " + numeroSerie);
    }
}
