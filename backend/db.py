"""
db.py — Pool de conexiones psycopg 3.

El pool se abre en el lifespan de main.py y se cierra al apagar.
Las rutas reciben una conexión mediante la dependencia `get_conn`.
"""

from psycopg_pool import AsyncConnectionPool

pool: AsyncConnectionPool | None = None


async def open_pool(conninfo: str) -> None:
    """Crea y abre el pool.  Llamar una sola vez al arrancar."""
    global pool
    pool = AsyncConnectionPool(
        conninfo=conninfo,
        min_size=1,
        max_size=5,
        open=False,
    )
    await pool.open()


async def close_pool() -> None:
    """Cierra el pool de forma ordenada.  Llamar al apagar."""
    global pool
    if pool is not None:
        await pool.close()
        pool = None


async def get_conn():
    """
    Dependencia FastAPI.  Entrega una conexión del pool y la devuelve
    al terminar la petición.

    Uso en una ruta:
        async def mi_ruta(conn=Depends(get_conn)): ...
    """
    if pool is None:
        raise RuntimeError("El pool de conexiones no está disponible.")
    async with pool.connection() as conn:
        yield conn
