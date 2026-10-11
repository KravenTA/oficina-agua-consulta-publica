package gt.edu.miumg.oficinaagua.consulta;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class NombreParcialTest {

    @Test
    void dejaLaPrimeraPalabraYAbreviaLasDemas() {
        assertEquals("Ana L*** M***", NombreParcial.enmascarar("Ana Lucia Moran"));
    }

    @Test
    void conDosPalabras() {
        assertEquals("Sofia H***", NombreParcial.enmascarar("Sofia Hernandez"));
    }

    @Test
    void conUnaSolaPalabra() {
        assertEquals("Sofia", NombreParcial.enmascarar("Sofia"));
    }

    @Test
    void ignoraEspaciosSobrantes() {
        assertEquals("Carlos P*** R***", NombreParcial.enmascarar("  Carlos   Perez  Ruiz "));
    }

    @Test
    void nuloOVacioDanTextoVacio() {
        assertEquals("", NombreParcial.enmascarar(null));
        assertEquals("", NombreParcial.enmascarar("   "));
    }
}
