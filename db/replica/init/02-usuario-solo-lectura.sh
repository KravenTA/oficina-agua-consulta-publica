#!/bin/bash
# Se ejecuta UNA sola vez, cuando se crea el volumen de la replica, despues de
# 01-oficina_agua.sql (los archivos de este directorio corren en orden alfabetico).
#
# Crea el usuario del ApiRest con permiso SELECT unicamente, y solo sobre las tablas
# que necesita la consulta publica. No tiene acceso a usuarios, roles, auditoria, etc.
#
# La imagen oficial puede ejecutar este archivo o cargarlo con "source", asi que
# no se usa "exit" en el camino normal.

crear_usuario_solo_lectura() {
    local base="${MYSQL_DATABASE}"
    local usuario="${REPLICA_DB_USER:-consulta_ro}"
    local clave="${REPLICA_DB_PASSWORD}"
    # Tablas que el ApiRest puede leer. Para ampliar el acceso, agregarlas aqui.
    local tablas="clientes servicios contadores lecturas periodos recibos pagos"

    if [ -z "$clave" ]; then
        echo "[replica] ERROR: REPLICA_DB_PASSWORD esta vacia; revisar el archivo .env" >&2
        return 1
    fi
    if ! [[ "$usuario" =~ ^[A-Za-z0-9_]+$ ]]; then
        echo "[replica] ERROR: REPLICA_DB_USER solo admite letras, numeros y guion bajo" >&2
        return 1
    fi

    # Escapar \ y ' para usar la clave dentro de un texto SQL
    local clave_sql
    clave_sql=$(printf '%s' "$clave" | sed -e 's/\\/\\\\/g' -e "s/'/''/g")

    local mysql_cmd=(mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" --batch --skip-column-names)

    "${mysql_cmd[@]}" -e "CREATE USER IF NOT EXISTS '${usuario}'@'%' IDENTIFIED BY '${clave_sql}';"

    local existentes concedidas=0
    existentes=$("${mysql_cmd[@]}" -e "SELECT table_name FROM information_schema.tables WHERE table_schema='${base}';")

    local t
    for t in $tablas; do
        if printf '%s\n' "$existentes" | grep -qx "$t"; then
            "${mysql_cmd[@]}" -e "GRANT SELECT ON \`${base}\`.\`${t}\` TO '${usuario}'@'%';"
            concedidas=$((concedidas + 1))
        else
            echo "[replica] AVISO: la tabla ${t} no existe en ${base}; no se concedio permiso" >&2
        fi
    done

    if [ "$concedidas" -eq 0 ]; then
        echo "[replica] AVISO: la replica esta VACIA (falta db/replica/init/01-oficina_agua.sql)." >&2
        echo "[replica] Generar el dump con scripts/refrescar-replica.ps1" >&2
    else
        echo "[replica] Usuario ${usuario}: SELECT sobre ${concedidas} tablas de ${base}."
    fi
}

crear_usuario_solo_lectura
