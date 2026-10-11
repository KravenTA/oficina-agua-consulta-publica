package gt.edu.miumg.oficinaagua.consulta;

/**
 * Oculta parcialmente el nombre del cliente: se deja la primera palabra completa y de las
 * demás solo la inicial. Ejemplo: "Ana Lucia Moran" -> "Ana L*** M***".
 */
public final class NombreParcial {

    private NombreParcial() {
    }

    public static String enmascarar(String nombre) {
        if (nombre == null || nombre.isBlank()) {
            return "";
        }
        String[] palabras = nombre.trim().split("\\s+");
        StringBuilder resultado = new StringBuilder(palabras[0]);
        for (int i = 1; i < palabras.length; i++) {
            String palabra = palabras[i];
            int fin = palabra.offsetByCodePoints(0, 1);
            resultado.append(' ')
                    .append(palabra.substring(0, fin).toUpperCase())
                    .append("***");
        }
        return resultado.toString();
    }
}
