# api/ — ApiRest de consulta (Spring Boot)

Servicio de **solo lectura** sobre la réplica MySQL.

| HU | Qué se construye aquí |
|---|---|
| HU-20 | Contrato OpenAPI (`openapi/`), generación de interfaces y DTOs, Swagger UI |
| HU-23 | Consulta de estado de cuenta por número de serie del contador (implementado) |
| HU-24 | Rate limit por IP (429 + `Retry-After`) (implementado) |

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

## Rate limit por IP

Segunda barrera contra el scraping del padrón, **independiente del captcha**: el ApiRest no
sabe nada del captcha, solo cuenta las consultas de cada IP. Si una IP supera su cupo, el
ApiRest responde `429` con la cabecera `Retry-After` (segundos que debe esperar) y el
cuerpo de error `LIMITE_EXCEDIDO`.

| Variable | Por defecto | Qué hace |
|---|---|---|
| `RATE_LIMIT_MAX_REQUESTS` | `10` | Consultas permitidas por IP dentro de la ventana |
| `RATE_LIMIT_WINDOW_SECONDS` | `60` | Tamaño de la ventana, en segundos |
| `RATE_LIMIT_TRUST_FORWARDED_FOR` | `false` (en Docker Compose: `true`) | Leer la IP real del cliente desde `X-Forwarded-For` |

Cómo funciona:

- Ventana **deslizante**: se permiten N consultas en cualquier ventana de T segundos.
- Solo protege `/api/*`; Swagger UI y el contrato no cuentan.
- Cuentan **todas** las consultas, también las que terminan en `404` (recorrer números de
  serie al azar es justo lo que se quiere frenar).
- Las consultas rechazadas no consumen cupo: insistir no alarga el bloqueo.
- Valores inválidos (por ejemplo `0`) hacen que el servicio no arranque.

**IP real del cliente.** El ApiRest recibe las consultas desde la capa Web, así que la IP de
la conexión siempre sería la de la Web y todos los clientes compartirían un solo cupo. Por
eso la capa Web (HU-26) debe enviar la IP real en `X-Forwarded-For`, **reemplazando** lo que
traiga la petición del navegador. El ApiRest usa la última entrada de la cabecera.
`RATE_LIMIT_TRUST_FORWARDED_FOR=true` solo es seguro si el ApiRest no es accesible
directamente desde internet; si lo fuera, cualquiera podría falsear la cabecera.

Limitación: el contador vive en memoria de cada instancia. Con varias instancias del ApiRest
cada una llevaría su propia cuenta.

Probarlo a mano (con `docker compose up -d`; el límite por defecto es 10 por minuto):

```powershell
1..12 | ForEach-Object { curl.exe -s -o NUL -w "%{http_code}\n" http://localhost:8081/api/v1/consulta/contadores/CTR-0003/estado-cuenta }
curl.exe -i http://localhost:8081/api/v1/consulta/contadores/CTR-0003/estado-cuenta
```

Las primeras 10 respuestas son `200` y las siguientes `429`. El segundo comando muestra la
cabecera `Retry-After`. Para cambiar el límite, editar el `.env` y correr `docker compose up -d`.

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

Cubren el cálculo de estados y resumen, la zona horaria, el enmascarado del nombre, los
códigos 200, 400, 404, 500 y 503 del controlador y el rate limit (ventana deslizante,
concurrencia, `Retry-After`, IP por cliente). No necesitan base de datos.

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
