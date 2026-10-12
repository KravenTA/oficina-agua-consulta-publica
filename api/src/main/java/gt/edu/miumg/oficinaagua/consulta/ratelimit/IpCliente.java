package gt.edu.miumg.oficinaagua.consulta.ratelimit;

import java.util.regex.Pattern;

/** Decide qué IP se usa para contar las consultas de un cliente. */
public final class IpCliente {

    // Solo caracteres de una IPv4/IPv6: evita que basura en la cabecera llene la memoria.
    private static final Pattern IP_VALIDA = Pattern.compile("^[0-9a-fA-F:.]{2,45}$");

    private IpCliente() {
    }

    /**
     * @param direccionRemota        IP de quien abrió la conexión (normalmente la capa Web)
     * @param xForwardedFor          valor de la cabecera X-Forwarded-For, si llegó
     * @param confiarEnForwardedFor  solo si el ApiRest está detrás de un proxy de confianza
     */
    public static String resolver(String direccionRemota, String xForwardedFor, boolean confiarEnForwardedFor) {
        String remota = (direccionRemota == null || direccionRemota.isBlank()) ? "desconocida" : direccionRemota;
        if (!confiarEnForwardedFor || xForwardedFor == null || xForwardedFor.isBlank()) {
            return remota;
        }
        // Se usa la ÚLTIMA entrada: es la que agregó el proxy de confianza. Las anteriores
        // pudo escribirlas el propio cliente, así que no se les cree.
        String[] partes = xForwardedFor.split(",");
        if (partes.length == 0) {
            return remota;
        }
        String ultima = partes[partes.length - 1].trim();
        return IP_VALIDA.matcher(ultima).matches() ? ultima : remota;
    }
}
