# api/ — ApiRest de consulta (Spring Boot)

Servicio de **solo lectura** sobre la réplica MySQL.

| HU | Qué se construye aquí |
|---|---|
| HU-20 | Contrato OpenAPI (`openapi/`), generación de interfaces y DTOs, Swagger UI |
| HU-23 | Consulta de estado de cuenta por número de serie del contador |
| HU-24 | Rate limit por IP (429 + `Retry-After`) |

## Contrato (contract-first)

El contrato vive en [`openapi/consulta-api.yaml`](openapi/consulta-api.yaml) y es la fuente
de verdad. **Primero se cambia el YAML, después el código.**

| Método | Ruta | Respuestas |
|---|---|---|
| GET | `/api/v1/consulta/contadores/{numeroSerie}/estado-cuenta` | 200, 400, 404, 429, 500, 503 |

## Generar interfaces y DTOs

`openapi-generator-maven-plugin` corre en la fase `generate-sources`:

```bash
cd api
mvn generate-sources
```

El código queda en `target/generated-sources/openapi/` (no se versiona). Contiene:

- `gt.edu.miumg.oficinaagua.consulta.api.ConsultaApi` — la **interfaz** que el equipo implementa (HU-23).
- `gt.edu.miumg.oficinaagua.consulta.api.model.*` — los DTOs (`EstadoCuenta`, `Recibo`, `ErrorRespuesta`, …).

## Swagger UI local

```bash
cd api
mvn spring-boot:run
```

Abrir <http://localhost:8081/swagger-ui.html> (redirige a `/swagger-ui/index.html`).
Muestra el YAML del contrato. El puerto se cambia con la variable `API_PORT`.

Si Swagger UI no carga, primero comprobar que el contrato llega al classpath:
<http://localhost:8081/openapi/consulta-api.yaml> debe mostrar el YAML.
No agregar `springdoc.api-docs.enabled=false`: apaga también Swagger UI.

Requisitos: JDK 21 y Maven 3.9+.

## Estructura

```
api/
├── openapi/
│   └── consulta-api.yaml     Contrato (fuente de verdad)
├── src/main/java/…/consulta/ Código Spring Boot
├── src/main/resources/       application.properties
└── pom.xml
```
