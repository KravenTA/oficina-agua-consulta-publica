# db/replica/ — Réplica MySQL del monolito

Scripts y configuración (HU-22) para cargar la réplica desde la instancia del monolito
(replicación o dump con las migraciones y seeds existentes) y crear el usuario
`consulta_ro` con permisos únicamente de lectura.

Aquí también se documenta **cómo refrescar la réplica**.

> El monolito no se modifica. Solo se lee de él para poblar la réplica.
