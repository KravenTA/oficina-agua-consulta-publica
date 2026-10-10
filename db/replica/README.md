# db/replica/ — Réplica MySQL del monolito

La réplica es una **copia de la base de datos del monolito** (`oficina_agua`) que vive en
su propio contenedor. El ApiRest de consulta pública lee **solo de aquí**, nunca de la
instancia original. El monolito únicamente se **lee** para generar la copia: no se modifica.

## Cómo se carga

Se usa un **dump** (`mysqldump`) del MySQL de Laragon. Al crear el contenedor por primera
vez, MySQL ejecuta en orden los archivos de `init/`:

| Archivo | Qué hace | ¿Se versiona? |
|---|---|---|
| `init/01-oficina_agua.sql` | Dump de la base del monolito (tablas, datos y rutinas) | **No** (puede traer datos personales; está en `.gitignore`) |
| `init/02-usuario-solo-lectura.sh` | Crea el usuario del ApiRest con permiso `SELECT` únicamente | Sí |

> Los archivos de `init/` **solo se ejecutan cuando el volumen de la réplica está vacío**.
> Por eso, para recargar hay que borrar el volumen (`docker compose down -v`).

## Cargar por primera vez o refrescar

Requisitos: MySQL de Laragon iniciado y Docker Desktop corriendo.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\refrescar-replica.ps1
```

El script hace tres cosas: genera el dump, borra el volumen de la réplica y la levanta de
nuevo (junto con el resto de servicios) esperando a que esté saludable.

Por defecto usa la base `oficina_agua`, usuario `root` sin clave, `127.0.0.1:3306`
(lo mismo que el `.env` del monolito). Si tu MySQL es distinto:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\refrescar-replica.ps1 -Usuario root -Clave "mi_clave" -Puerto 3306
```

Si no encuentra `mysqldump`, indícalo con `-Mysqldump "C:\ruta\a\mysqldump.exe"`.

**¿Cuándo refrescar?** Cuando cambien los datos del monolito y quieras verlos en la consulta
pública (nuevos recibos, pagos, etc.). La réplica es una foto del momento del dump.

### Los mismos pasos, a mano

```powershell
mysqldump -h127.0.0.1 -uroot --single-transaction --routines --result-file=db\replica\init\01-oficina_agua.sql oficina_agua
docker compose down -v
docker compose up -d --wait
```

## Usuario de solo lectura

El ApiRest se conecta con `REPLICA_DB_USER` / `REPLICA_DB_PASSWORD` (del `.env`).
Ese usuario:

- Tiene únicamente `SELECT`, y solo sobre las tablas que necesita la consulta:
  `clientes`, `servicios`, `contadores`, `lecturas`, `periodos`, `recibos`, `pagos`.
- **No** puede leer `usuarios`, `roles`, `auditoria`, etc., aunque existan en la réplica.
- No puede insertar, modificar, borrar ni administrar nada.

Para dar acceso a otra tabla, agregarla a la variable `tablas` de `init/02-usuario-solo-lectura.sh`
y refrescar la réplica.

## Verificar que quedó bien

```powershell
docker compose logs mysql-replica | findstr replica
```

Debe aparecer `Usuario consulta_ro: SELECT sobre 7 tablas de oficina_agua`.
Si aparece `la replica esta VACIA`, falta generar el dump.

Entrar a la réplica como el usuario del ApiRest (pide la clave de `REPLICA_DB_PASSWORD`):

```powershell
docker compose exec mysql-replica mysql -uconsulta_ro -p oficina_agua
```

```sql
SELECT COUNT(*) FROM contadores;          -- funciona
SELECT * FROM usuarios;                   -- ERROR 1142: SELECT command denied
DELETE FROM contadores WHERE 1=0;         -- ERROR 1142: DELETE command denied
```

## Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| `mysqldump fallo` / `Can't connect` | El MySQL de Laragon no está iniciado, o usuario/clave/puerto son otros. |
| La réplica sigue vacía después de cargar | El volumen ya existía. Usar el script, que hace `down -v`. |
| `unhealthy` en la primera carga | El dump es grande y tardó más de lo esperado. Ver `docker compose logs mysql-replica`. |
| Error de `collation` al cargar el dump | El MySQL de Laragon y el del contenedor son de versiones muy distintas. Avisar al equipo. |
