"""
routers/alertas.py — GET /api/alertas  y  PATCH /api/alertas/{id}
"""

import logging
from datetime import timezone, datetime
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

import db

logger = logging.getLogger(__name__)
router = APIRouter()

_TIPO_LABEL = {
    "humedad_baja":     "Humedad baja",
    "sobrehumedad":     "Sobrehumedad",
    "sin_reporte":      "Nodo sin conexión",
    "bateria_baja":     "Batería baja",
    "lectura_invalida": "Lectura inválida",
}


def _fmt_ts(ts: datetime | None) -> str | None:
    if ts is None:
        return None
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts.isoformat()


# ── GET /api/alertas ──────────────────────────────────────────────────────────

@router.get("/api/alertas", summary="Listar alertas con filtros", tags=["Alertas"])
async def listar_alertas(
    estado: str = Query("activa", pattern="^(activa|resuelta|todas)$"),
    zona: int | None = Query(None),
    tipo: str | None = Query(None),
):
    condiciones = ["TRUE"]
    params: list = []

    if estado == "activa":
        condiciones.append("a.abierta = TRUE")
    elif estado == "resuelta":
        condiciones.append("a.abierta = FALSE")

    if zona is not None:
        condiciones.append("a.id_zona = %s")
        params.append(zona)
    if tipo is not None:
        condiciones.append("a.tipo = %s")
        params.append(tipo)

    where = " AND ".join(condiciones)

    async with db.pool.connection() as conn:
        rows = await (await conn.execute(
            f"""
            SELECT a.id_alerta, a.id_zona, z.nombre AS nombre_zona,
                   a.tipo, a.abierta, a.timestamp_apertura, a.timestamp_cierre
              FROM alerta a
              JOIN zona z ON z.id_zona = a.id_zona
             WHERE {where}
             ORDER BY a.abierta DESC, a.timestamp_apertura DESC
            """,
            params,
        )).fetchall()

    return [
        {
            "id": r[0],
            "id_zona": r[1],
            "zona": r[2],
            "tipo": r[3],
            "tipo_label": _TIPO_LABEL.get(r[3], r[3]),
            "abierta": r[4],
            "timestamp_apertura": _fmt_ts(r[5]),
            "timestamp_cierre": _fmt_ts(r[6]),
        }
        for r in rows
    ]


# ── PATCH /api/alertas/{id} ───────────────────────────────────────────────────

class AlertaAccionIn(BaseModel):
    accion: str

    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if isinstance(v, dict) and v.get("accion") not in ("atendida", "resuelta"):
            raise ValueError("accion debe ser 'atendida' o 'resuelta'")
        return cls(**v)


@router.patch("/api/alertas/{id_alerta}", summary="Marcar alerta como atendida o resuelta", tags=["Alertas"])
async def actualizar_alerta(id_alerta: int, body: dict):
    accion = body.get("accion", "")
    if accion not in ("atendida", "resuelta"):
        raise HTTPException(status_code=422, detail="accion debe ser 'atendida' o 'resuelta'.")

    async with db.pool.connection() as conn:
        result = await conn.execute(
            """
            UPDATE alerta
               SET abierta = FALSE, timestamp_cierre = NOW()
             WHERE id_alerta = %s AND abierta = TRUE
            """,
            (id_alerta,),
        )
        if result.rowcount == 0:
            row = await (await conn.execute(
                "SELECT id_alerta FROM alerta WHERE id_alerta = %s", (id_alerta,)
            )).fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail=f"No existe la alerta con id {id_alerta}.")
            raise HTTPException(status_code=409, detail="La alerta ya estaba cerrada.")

    logger.info("Alerta %d marcada como %s.", id_alerta, accion)
    return {"ok": True, "id_alerta": id_alerta, "accion": accion}
