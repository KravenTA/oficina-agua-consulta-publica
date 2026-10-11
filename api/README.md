# api/ — ApiRest de consulta (Spring Boot)

Servicio de **solo lectura** sobre la réplica MySQL.

| HU | Qué se construye aquí |
|---|---|
| HU-20 | Contrato OpenAPI (`openapi/`), generación de interfaces y DTOs, Swagger UI |
| HU-23 | Consulta de estado de cuenta por número de serie del contador (implementado) |
| HU-24 | Rate limit por IP (429 + `Retry-After`) |

## Contrato (contract-first)

El contrato vive en [`openapi/consulta-api.yaml`](openapi/consulta-api.yaml) y es la fuente
de verdad. **Primero se cambia el YAML, después el código.**

| Método | Ruta | Respuestas |
|---|---|---|
| GET | `/api/v1/consulta/contadores/{numeroSerie}/estado-cuenta` | 200, 400, 404, 429, 500, 503 |

## Probar el endpoint

Con `docker compose up -d` y la réplica cargada (ver `db/replica/README.md`):

```powershell
curl.exe http://localhost:8081/api/v1/consulta/contadores/CTR-0001/estado-cuenta
```

Para ver qué números de serie existen en tu réplica:

```powershell
docker compose exec mysql-replica mysql -uconsulta_ro -p oficina_agua -e "SELECT numero_serie FROM contadores LIMIT 5;"
```

| Caso | Respuesta |
|---|---|
| Serie existente | `200` con contador, cliente (nombre parcial), recibos y resumen |
| Serie inexistente o contador inactivo | `404` · `CONTADOR_NO_ENCONTRADO` |
| Formato inválido (`AB`, `CTR_01`) | `400` · `SERIE_INVALIDA` |
| Réplica caída | `503` · `SERVICIO_NO_DISPONIBLE` |
| Error inesperado | `500` · `ERROR_INTERNO` (sin detalles técnicos) |

Reglas de la respuesta:

- Un recibo `pendiente` cuya fecha de vencimiento ya pasó se devuelve como `VENCIDO`
  (el monolito no actualiza ese estado). "Hoy" se calcula en la zona `America/Guatemala`.
- Los recibos anulados no se incluyen.
- El nombre del cliente sale parcial (`Ana L*** M***`). No se devuelve DPI, NIT, teléfono,
  correo ni dirección.
- La respuesta lleva `Cache-Control: no-store`.

## Configuración

Variables de entorno (ya definidas en `docker-compose.yml` y `.env.example`):

| Variable | Por defecto (fuera de Docker) | Uso |
|---|---|---|
| `REPLICA_DB_HOST` | `localhost` | Host de la réplica (`mysql-replica` dentro de Docker) |
| `REPLICA_DB_PORT` | `3307` | Puerto de la réplica (`3306` dentro de Docker) |
| `REPLICA_DB_NAME` | `oficina_agua` | Base de datos |
| `REPLICA_DB_USER` / `REPLICA_DB_PASSWORD` | `consulta_ro` / vacío | Usuario de solo lectura |

El pool de conexiones se abre en modo solo lectura.

## Pruebas automatizadas

```bash
cd api
mvn test
```

Cubren el cálculo de estados y resumen, la zona horaria, el enmascarado del nombre y los
códigos 200, 400, 404, 500 y 503 del controlador. No necesitan base de datos.

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
├── src/main/java/…/consulta/ Código Spring Boot (controlador, servicio, repositorio)
├── src/test/java/…/consulta/ Pruebas automatizadas
├── src/main/resources/       application.properties
└── pom.xml
```
