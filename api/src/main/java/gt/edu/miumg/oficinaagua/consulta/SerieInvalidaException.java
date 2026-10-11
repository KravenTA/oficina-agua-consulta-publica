package gt.edu.miumg.oficinaagua.consulta;

/** El número de serie no cumple el formato del contrato (3 a 30 letras, números o guiones). */
public class SerieInvalidaException extends RuntimeException {

    public SerieInvalidaException() {
        super("Número de serie con formato inválido");
    }
}
