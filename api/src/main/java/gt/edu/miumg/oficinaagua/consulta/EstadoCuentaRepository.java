package gt.edu.miumg.oficinaagua.consulta;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Consultas de SOLO LECTURA sobre la réplica MySQL. Aquí no hay INSERT, UPDATE ni DELETE,
 * y el usuario de base de datos tampoco tiene permiso para ejecutarlos.
 */
@Repository
public class EstadoCuentaRepository {

    public record ContadorCliente(String numeroSerie, String tipoServicio, String nombreCliente) {
    }

    public record ReciboFila(String numero, int anio, int mes, LocalDate fechaEmision,
                             LocalDate fechaVencimiento, BigDecimal consumoM3,
                             BigDecimal total, String estado) {
    }

    private static final String SQL_CONTADOR = """
            SELECT c.numero_serie, c.tipo_servicio, cl.nombre
            FROM contadores c
            JOIN servicios s ON s.id = c.servicio_id
            JOIN clientes cl ON cl.id = s.cliente_id
            WHERE c.numero_serie = ? AND c.activo = 1
            LIMIT 1
            """;

    // Los recibos anulados no se muestran al cliente.
    private static final String SQL_RECIBOS = """
            SELECT r.numero, p.anio, p.mes, r.fecha_emision, r.fecha_vencimiento,
                   COALESCE(l.consumo, l.lectura_actual - l.lectura_anterior) AS consumo,
                   r.total, r.estado
            FROM contadores c
            JOIN lecturas l ON l.contador_id = c.id
            JOIN recibos r ON r.lectura_id = l.id
            JOIN periodos p ON p.id = l.periodo_id
            WHERE c.numero_serie = ? AND c.activo = 1 AND r.estado <> 'anulado'
            ORDER BY p.anio DESC, p.mes DESC, r.id DESC
            """;

    private final JdbcTemplate jdbc;

    public EstadoCuentaRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<ContadorCliente> buscarContador(String numeroSerie) {
        List<ContadorCliente> filas = jdbc.query(SQL_CONTADOR,
                (rs, i) -> new ContadorCliente(
                        rs.getString("numero_serie"),
                        rs.getString("tipo_servicio"),
                        rs.getString("nombre")),
                numeroSerie);
        return filas.stream().findFirst();
    }

    public List<ReciboFila> listarRecibos(String numeroSerie) {
        return jdbc.query(SQL_RECIBOS, (rs, i) -> {
            LocalDateTime emision = rs.getObject("fecha_emision", LocalDateTime.class);
            return new ReciboFila(
                    rs.getString("numero"),
                    rs.getInt("anio"),
                    rs.getInt("mes"),
                    emision == null ? null : emision.toLocalDate(),
                    rs.getObject("fecha_vencimiento", LocalDate.class),
                    rs.getBigDecimal("consumo"),
                    rs.getBigDecimal("total"),
                    rs.getString("estado"));
        }, numeroSerie);
    }
}
