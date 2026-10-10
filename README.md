# Oficina del Agua — Feature 1: Consulta Pública con Captcha

Fase 2 · Desarrollo Web 2026 · Universidad Mariano Gálvez

Página pública, **sin login**, donde el cliente final consulta su estado de cuenta
con el número de serie de su contador. Está protegida por captcha (primera barrera)
y por rate limit por IP en el ApiRest (segunda barrera, independiente).

> **Este repositorio es independiente del monolito.** El monolito
> ([proyecto-agua-keko](https://github.com/KravenTA/proyecto-agua-keko)) **no se toca**:
> aquí solo se construye lo nuevo, al lado. El ApiRest lee únicamente de una
> **réplica MySQL**, nunca de la base de datos original.

## Equipo

| Nombre completo | Carnet | Correo electrónico | Rol dentro del equipo |
|---|---|---|---|
| Yourgen Kraven Thommel Arevalo | 0905-23-14003 | ythommela@miumg.edu.gt | Coordinador |
| Karen Yamileth Jiménez Galicia | 0905-23-7626 | kjimenezg6@miumg.edu.gt | Desarrolladora |
| Enner Osvaldo Godoy Ramirez | 0905-23-15908 | egodoyr2@miumg.edu.gt | Desarrollador |
| Oliver Isaac Godoy Salguero | 0905-23-10816 | ogodoys@miumg.edu.gt | Desarrollador |

**Responsable de la feature:** Yourgen Kraven Thommel Arevalo
**Proyecto en Jira:** SDGODA · Épica 11 — Feature 1

## Arquitectura

```
 Navegador ──► Web (captcha) ──http──► ApiRest (Spring Boot) ──► Réplica MySQL
                  │                        │  rate limit por IP       ▲
                  └─ valida el captcha     └─ solo lectura            │ dump / replicación
                     en servidor                               Instancia MySQL del monolito
```

El diagrama completo de la Fase 2 está en [`docs/arquitectura-fase2.png`](docs/arquitectura-fase2.png).

## Estructura del repositorio

```
.
├── api/                  ApiRest de consulta (Spring Boot) — HU-20, HU-23, HU-24
├── web/                  Capa Web con captcha — HU-25, HU-26, HU-27
├── db/replica/           Réplica MySQL: usuario de solo lectura y carga — HU-22
├── scripts/              Scripts de apoyo (refrescar la réplica)
├── docs/                 Diagramas y documentación
├── .github/              Plantilla de pull request
├── docker-compose.yml    Orquestación de la feature — HU-21
├── .env.example          Variables de entorno (copiar a .env)
└── README.md
```

## Cómo levantarla

Requisitos: Docker Desktop (o Docker y Docker Compose) y Git.

```bash
git clone https://github.com/KravenTA/oficina-agua-consulta-publica.git
cd oficina-agua-consulta-publica
cp .env.example .env        # ajustar valores (nunca subir el .env)
docker compose up --build
```

En Windows (CMD) el segundo paso es `copy .env.example .env`.

| Servicio | Qué es | Puerto en tu máquina | Estado |
|---|---|---|---|
| `mysql-replica` | Réplica MySQL del monolito | `3307` | Se carga con `scripts\refrescar-replica.ps1` (ver abajo) |
| `api` | ApiRest de consulta | `8081` | Swagger UI en <http://localhost:8081/swagger-ui.html> |
| `web` | Página pública con captcha | `3000` | Perfil `web`, disponible desde la HU-25 |

**Orden de arranque:** primero `mysql-replica` (espera a estar saludable), luego `api`,
luego `web`. Compose lo resuelve solo con `depends_on`.

**Aislamiento:** los servicios viven en la red `consulta-net`. La instancia MySQL del
monolito no está en esa red y el ApiRest solo conoce el host `mysql-replica`.
El monolito no se modifica.

### Cargar la réplica con los datos del monolito

La réplica arranca vacía. Se llena con un dump de la base `oficina_agua` del monolito
(MySQL de Laragon, que debe estar iniciado):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\refrescar-replica.ps1
```

Ese mismo comando **refresca** la réplica cuando cambian los datos. El dump no se sube a
git. El ApiRest se conecta con un usuario de solo lectura. Detalles y verificación en
[`db/replica/README.md`](db/replica/README.md).

Comandos útiles:

```bash
docker compose ps                    # estado de los servicios
docker compose logs -f api           # ver el log del ApiRest
docker compose --profile web up      # incluir la capa Web (cuando exista, HU-25)
docker compose down                  # detener
docker compose down -v               # detener y borrar los datos de la réplica
```

El puerto de la réplica es `3307` y no `3306` para no chocar con el MySQL local
(Laragon, XAMPP). Si algún puerto ya está en uso, cámbialo en tu `.env`
(`API_PORT`, `WEB_PORT`, `REPLICA_DB_HOST_PORT`).

## Flujo de trabajo del equipo

Se trabaja con ramas y pull requests. **Nunca directo sobre `main`.**

```bash
git checkout main
git pull
git checkout -b feature/SDGODA-XX-descripcion-corta
```

Prefijos de commit: `feat:` funcionalidad nueva · `fix:` correcciones ·
`chore:` configuración y mantenimiento · `refactor:` reorganizar sin cambiar
comportamiento · `style:` formato · `docs:` documentación.

Antes de abrir el PR, traer `main` a la rama para resolver conflictos:

```bash
git fetch origin
git merge origin/main
```

## Reglas de esta fase

- El monolito heredado no se toca, ni para agregar un endpoint de lectura.
- El ApiRest solo ve la réplica MySQL, nunca la instancia original.
- Contract-first: primero el YAML de OpenAPI, después el código.
- Ningún dato sensible (DPI, NIT, teléfono) sale en la consulta pública.
- Claves y credenciales solo en variables de entorno, documentadas en `.env.example`.
