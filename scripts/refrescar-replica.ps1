<#
.SYNOPSIS
  Genera un dump de la base del monolito (MySQL de Laragon) y recarga la replica.

.DESCRIPTION
  1. mysqldump de la base del monolito -> db\replica\init\01-oficina_agua.sql
  2. docker compose down -v   (borra el volumen de la replica)
  3. docker compose up -d --wait   (la replica se vuelve a crear y carga el dump)

  El monolito solo se LEE: no se modifica nada en su base de datos.
  El archivo .sql no se sube a git (puede contener datos personales).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\refrescar-replica.ps1

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\refrescar-replica.ps1 -Clave "mi_clave" -Puerto 3306
#>
param(
    [string]$Base = "oficina_agua",
    [string]$Usuario = "root",
    [string]$Clave = "",
    [string]$Servidor = "127.0.0.1",
    [int]$Puerto = 3306,
    [string]$Mysqldump = ""
)

$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz
$destino = Join-Path $raiz "db\replica\init\01-oficina_agua.sql"

# --- 1. Localizar mysqldump (Laragon o el que este en el PATH) ---
if (-not $Mysqldump) {
    $candidato = Get-ChildItem "C:\laragon\bin\mysql\*\bin\mysqldump.exe" -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
    if ($candidato) {
        $Mysqldump = $candidato.FullName
    } else {
        $cmd = Get-Command mysqldump -ErrorAction SilentlyContinue
        if ($cmd) { $Mysqldump = $cmd.Source }
    }
}
if (-not $Mysqldump -or -not (Test-Path $Mysqldump)) {
    throw "No se encontro mysqldump. Indicalo con: -Mysqldump 'C:\ruta\a\mysqldump.exe'"
}
Write-Host "[1/3] Usando $Mysqldump"

# --- 2. Dump del monolito (solo lectura) ---
Write-Host "[1/3] Generando dump de '$Base' en ${Servidor}:${Puerto} ..."
$argumentos = @(
    "--host=$Servidor",
    "--port=$Puerto",
    "--user=$Usuario",
    "--single-transaction",
    "--routines",
    "--default-character-set=utf8mb4",
    "--result-file=$destino"
)
if ($Clave) { $argumentos += "--password=$Clave" }

# mysqldump 8.x consulta information_schema.COLUMN_STATISTICS, tabla que no existe en
# MariaDB ni en MySQL 5.7. Si el cliente soporta la opcion, se desactiva.
$ayuda = (& $Mysqldump --help) | Out-String
if ($ayuda -match "column-statistics") { $argumentos += "--column-statistics=0" }

$argumentos += $Base

& $Mysqldump @argumentos
if ($LASTEXITCODE -ne 0) {
    throw "mysqldump fallo (codigo $LASTEXITCODE). Revisa que el MySQL de Laragon este iniciado y que usuario/clave sean correctos."
}
if (-not (Test-Path $destino) -or (Get-Item $destino).Length -lt 1000) {
    throw "El dump salio vacio o demasiado pequeno: $destino"
}
$version = Select-String -Path $destino -Pattern "Server version" -List | Select-Object -First 1
if ($version) { Write-Host "      $($version.Line.Trim())" }
Write-Host ("      Dump listo: {0:N0} KB" -f ((Get-Item $destino).Length / 1KB))

# --- 3. Recrear la replica ---
Write-Host "[2/3] Borrando el volumen de la replica ..."
docker compose down -v
if ($LASTEXITCODE -ne 0) { throw "docker compose down fallo" }

Write-Host "[3/3] Levantando la replica con el dump nuevo ..."
docker compose up -d --wait
if ($LASTEXITCODE -ne 0) { throw "docker compose up fallo. Revisa: docker compose logs mysql-replica" }

Write-Host ""
Write-Host "Listo. Verifica con: docker compose logs mysql-replica | findstr replica"
