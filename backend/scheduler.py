"""
scheduler.py — Job periódico: nodos sin reporte.
"""

import logging
import db
import config

logger = logging.getLogger(__name__)


async def revisar_nodos_sin_reporte() -> None:
    minutos = config.cfg.get("minutos_sin_reporte", 45)
    try:
        async with db.pool.connection() as conn:
            rows = await (await conn.execute(
                """
                SELECT n.id_nodo, n.id_zona, n.nombre, n.ultima_conexion
                  FROM nodo n
                 WHERE n.ultima_conexion IS NULL
                    OR n.ultima_conexion < NOW() - (%s * INTERVAL '1 minute')
                """,
                (minutos,),
            )).fetchall()

            for id_nodo, id_zona, nombre, ultima_conexion in rows:
                result = await conn.execute(
                    """
                    INSERT INTO alerta (id_zona, tipo, abierta, timestamp_apertura)
                    VALUES (%s, 'sin_reporte', TRUE, NOW())
                    ON CONFLICT DO NOTHING
                    """,
                    (id_zona,),
                )
                if result.rowcount:
                    logger.warning(
                        "sin_reporte: nodo=%s zona=%d última_conexión=%s",
                        nombre or id_nodo, id_zona, ultima_conexion,
                    )
    except Exception as exc:
        logger.error("Error en revisar_nodos_sin_reporte: %s", exc)
