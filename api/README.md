# api/ — ApiRest de consulta (Spring Boot)

Servicio de **solo lectura** sobre la réplica MySQL.

| HU | Qué se construye aquí |
|---|---|
| HU-20 | Contrato OpenAPI (`openapi/`), generación de interfaces y DTOs, Swagger UI |
| HU-23 | Consulta de estado de cuenta por número de serie del contador |
| HU-24 | Rate limit por IP (429 + `Retry-After`) |

Estructura prevista:

```
api/
├── openapi/            Contrato YAML (contract-first)
├── src/                Código Spring Boot
├── pom.xml
└── Dockerfile
```
