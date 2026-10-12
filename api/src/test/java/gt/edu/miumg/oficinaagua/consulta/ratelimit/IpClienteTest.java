package gt.edu.miumg.oficinaagua.consulta.ratelimit;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class IpClienteTest {

    @Test
    void sinConfianzaIgnoraLaCabecera() {
        assertEquals("172.18.0.5", IpCliente.resolver("172.18.0.5", "203.0.113.7", false));
    }

    @Test
    void conConfianzaUsaLaIpDeLaCabecera() {
        assertEquals("203.0.113.7", IpCliente.resolver("172.18.0.5", "203.0.113.7", true));
    }

    @Test
    void conVariasEntradasUsaLaUltima() {
        // "1.2.3.4" pudo escribirla el propio cliente; la ultima la agrego el proxy de confianza.
        assertEquals("203.0.113.7", IpCliente.resolver("172.18.0.5", "1.2.3.4, 203.0.113.7", true));
    }

    @Test
    void sinCabeceraUsaLaIpDelSocket() {
        assertEquals("172.18.0.5", IpCliente.resolver("172.18.0.5", null, true));
        assertEquals("172.18.0.5", IpCliente.resolver("172.18.0.5", "   ", true));
    }

    @Test
    void conCabeceraInvalidaUsaLaIpDelSocket() {
        assertEquals("172.18.0.5", IpCliente.resolver("172.18.0.5", "no-es-una-ip!", true));
        assertEquals("172.18.0.5", IpCliente.resolver("172.18.0.5", ",", true));
        assertEquals("172.18.0.5", IpCliente.resolver("172.18.0.5", "a".repeat(200), true));
    }

    @Test
    void aceptaIpv6() {
        assertEquals("2001:db8::1", IpCliente.resolver("172.18.0.5", "2001:db8::1", true));
    }

    @Test
    void sinNingunaDireccionDevuelveDesconocida() {
        assertEquals("desconocida", IpCliente.resolver(null, null, false));
    }
}
