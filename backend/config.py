"""
config.py — Configuración del servidor.

Lee las variables del .env con python-dotenv y construye el conninfo
de psycopg 3.  Los parámetros del sistema (intervalo_lectura,
minutos_sin_reporte, bateria_baja) se cargan de la tabla configuracion
al arrancar y se exponen en el dict `cfg`.
"""

import os
from dotenv import load_dotenv

load_dotenv()


def _require(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(
            f"Falta la variable de entorno requerida: {name}. "
            "Copia .env.example a .env y rellena los valores."
        )
    return value


# ── Parámetros de conexión leídos del .env ──────────────────────────────────
DB_HOST: str = _require("DB_HOST")
DB_PORT: str = os.getenv("DB_PORT", "5432")
DB_NAME: str = _require("DB_NAME")
DB_USER: str = _require("DB_USER")
DB_PASSWORD: str = _require("DB_PASSWORD")

# conninfo para psycopg 3
CONNINFO: str = (
    f"host={DB_HOST} port={DB_PORT} dbname={DB_NAME} "
    f"user={DB_USER} password={DB_PASSWORD}"
)

# ── Parámetros del sistema cargados de la tabla configuracion ───────────────
# Se rellena en el lifespan de main.py; las rutas lo leen solo después
# del arranque, por lo que siempre estará disponible.
cfg: dict[str, float] = {}


async def load_cfg(pool) -> dict[str, float]:
    """Carga la tabla configuracion y devuelve un dict {clave: valor}."""
    async with pool.connection() as conn:
        rows = await conn.execute(
            "SELECT clave, valor FROM configuracion"
        )
        result = {row[0]: float(row[1]) async for row in rows}
    return result
