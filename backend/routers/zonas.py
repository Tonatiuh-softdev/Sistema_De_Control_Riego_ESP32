"""
routers/zonas.py — Endpoints de zonas para la Tarea 3

GET  /api/panel
GET  /api/zonas/{id}
GET  /api/zonas/{id}/estadisticas?periodo=24h|7d
PUT  /api/zonas/{id}/planta
PATCH /api/zonas/{id}
"""

import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, field_validator

import db
import config

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


def _fmt_hora(ts: datetime | None) -> str:
    if ts is None:
        return "—"
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    local = ts.astimezone()
    hoy = datetime.now().date()
    ayer = hoy - timedelta(days=1)
    if local.date() == hoy:
        return f"Hoy {local.strftime('%H:%M')}"
    if local.date() == ayer:
        return f"Ayer {local.strftime('%H:%M')}"
    return local.strftime("%d/%m/%Y %H:%M")


def _estado_zona(humedad, hmin, hmax, sin_conexion, tiene_planta, pausada):
    if pausada:
        return "pausada"
    if not tiene_planta:
        return "sin planta"
    if sin_conexion:
        return "sin conexión"
    if humedad is None:
        return "sin lecturas"
    if humedad < hmin:
        return "seca"
    if humedad > hmax:
        return "sobrehumedad"
    return "en rango"


# ── GET /api/panel ────────────────────────────────────────────────────────────

@router.get("/api/panel", summary="Panel de zonas", tags=["Panel"])
async def panel():
    async with db.pool.connection() as conn:
        minutos_sin_reporte = config.cfg.get("minutos_sin_reporte", 45)

        zonas_rows = await (await conn.execute(
            """
            SELECT
                z.id_zona, z.nombre, z.estado AS zona_estado,
                n.id_nodo, n.nombre AS nombre_nodo, n.ultima_conexion,
                p.id_planta, p.nombre_comun, p.humedad_min, p.humedad_max, p.imagen_ruta,
                (SELECT l.humedad_pct FROM lectura l WHERE l.id_nodo = n.id_nodo
                 ORDER BY l.timestamp DESC LIMIT 1) AS humedad_pct,
                (SELECT l.timestamp FROM lectura l WHERE l.id_nodo = n.id_nodo
                 ORDER BY l.timestamp DESC LIMIT 1) AS ultima_lectura_ts,
                (SELECT COUNT(*) FROM alerta a
                 WHERE a.id_zona = z.id_zona AND a.abierta = TRUE) AS alertas_count,
                (SELECT a.tipo FROM alerta a WHERE a.id_zona = z.id_zona AND a.abierta = TRUE
                 ORDER BY CASE a.tipo
                   WHEN 'sin_reporte' THEN 1 WHEN 'humedad_baja' THEN 2
                   WHEN 'sobrehumedad' THEN 3 WHEN 'bateria_baja' THEN 4
                   ELSE 5 END LIMIT 1) AS alerta_tipo
            FROM zona z
            LEFT JOIN nodo n ON n.id_zona = z.id_zona
            LEFT JOIN zona_planta zp ON zp.id_zona = z.id_zona AND zp.fecha_fin IS NULL
            LEFT JOIN planta p ON p.id_planta = zp.id_planta AND p.activa = TRUE
            ORDER BY z.id_zona
            """
        )).fetchall()

        total_alertas = (await (await conn.execute(
            "SELECT COUNT(*) FROM alerta WHERE abierta = TRUE"
        )).fetchone())[0]

    now = datetime.now(timezone.utc)
    zonas = []
    nodos_online = 0

    for r in zonas_rows:
        (id_zona, nombre_zona, zona_estado, id_nodo, nombre_nodo, ultima_conexion,
         id_planta, planta, hmin, hmax, imagen_ruta,
         humedad_pct, ultima_lectura_ts, alertas_count, alerta_tipo) = r

        humedad = float(humedad_pct) if humedad_pct is not None else None
        tiene_planta = planta is not None
        pausada = zona_estado == 'pausada'

        sin_conexion = False
        if id_nodo:
            if ultima_conexion:
                if ultima_conexion.tzinfo is None:
                    ultima_conexion = ultima_conexion.replace(tzinfo=timezone.utc)
                sin_conexion = (now - ultima_conexion).total_seconds() / 60 > minutos_sin_reporte
            else:
                sin_conexion = True

        if not sin_conexion and id_nodo:
            nodos_online += 1

        estado = _estado_zona(humedad, float(hmin) if hmin else None,
                               float(hmax) if hmax else None, sin_conexion, tiene_planta, pausada)

        zonas.append({
            "id": id_zona,
            "nombre": nombre_zona,
            "estado_zona": zona_estado,
            "planta": {"nombre": planta, "imagen": imagen_ruta} if tiene_planta else None,
            "humedad": humedad,
            "rango": [float(hmin), float(hmax)] if hmin is not None else None,
            "estado": estado,
            "nodo": {
                "nombre": nombre_nodo or nombre_zona,
                "en_linea": not sin_conexion,
                "ultima_conexion": _fmt_ts(ultima_conexion),
            },
            "ultima_lectura": _fmt_hora(ultima_lectura_ts),
            "alertas_activas": int(alertas_count),
            "alerta_principal": _TIPO_LABEL.get(alerta_tipo, "") if alerta_tipo else "",
        })

    return {
        "hora_actualizacion": _fmt_ts(now),
        "alertas_activas": int(total_alertas),
        "nodos_online": nodos_online,
        "nodos_total": len(zonas),
        "zonas": zonas,
    }


# ── GET /api/zonas/{id} ───────────────────────────────────────────────────────

@router.get("/api/zonas/{id_zona}", summary="Ficha completa de una zona", tags=["Zonas"])
async def detalle_zona(id_zona: int):
    async with db.pool.connection() as conn:
        zona_row = await (await conn.execute(
            """
            SELECT z.id_zona, z.nombre, z.estado AS zona_estado,
                   n.id_nodo, n.nombre AS nombre_nodo, n.ultima_conexion,
                   p.id_planta, p.nombre_comun, p.nombre_cientifico,
                   p.humedad_min, p.humedad_max, p.temperatura_min, p.temperatura_max,
                   p.luz, p.descripcion, p.notas_cuidado, p.imagen_ruta, p.imagen_credito,
                   p.uso, p.necesidad_agua, cp.nombre AS categoria
            FROM zona z
            LEFT JOIN nodo n ON n.id_zona = z.id_zona
            LEFT JOIN zona_planta zp ON zp.id_zona = z.id_zona AND zp.fecha_fin IS NULL
            LEFT JOIN planta p ON p.id_planta = zp.id_planta AND p.activa = TRUE
            LEFT JOIN categoria_planta cp ON cp.id_categoria = p.id_categoria
            WHERE z.id_zona = %s
            """,
            (id_zona,),
        )).fetchone()

        if zona_row is None:
            raise HTTPException(status_code=404, detail="Zona no encontrada.")

        (_, nombre_zona, zona_estado, id_nodo, nombre_nodo, ultima_conexion,
         id_planta, planta, cientifico, hmin, hmax, tmin, tmax,
         luz, descripcion, notas_cuidado, imagen_ruta, imagen_credito,
         uso, necesidad_agua, categoria) = zona_row

        ultima = await (await conn.execute(
            """
            SELECT humedad_pct, temperatura_ambiente, humedad_ambiente, voltaje_bateria, timestamp
              FROM lectura WHERE id_nodo = %s ORDER BY timestamp DESC LIMIT 1
            """,
            (id_nodo,),
        )).fetchone() if id_nodo else None

        alertas = await (await conn.execute(
            """
            SELECT id_alerta, tipo, abierta, timestamp_apertura, timestamp_cierre
              FROM alerta WHERE id_zona = %s
             ORDER BY abierta DESC, timestamp_apertura DESC LIMIT 10
            """,
            (id_zona,),
        )).fetchall()

    now = datetime.now(timezone.utc)
    minutos_sin_reporte = config.cfg.get("minutos_sin_reporte", 45)

    sin_conexion = False
    if id_nodo:
        if ultima_conexion:
            if ultima_conexion.tzinfo is None:
                ultima_conexion = ultima_conexion.replace(tzinfo=timezone.utc)
            sin_conexion = (now - ultima_conexion).total_seconds() / 60 > minutos_sin_reporte
        else:
            sin_conexion = True

    humedad = float(ultima[0]) if ultima else None
    hmin_f = float(hmin) if hmin is not None else None
    hmax_f = float(hmax) if hmax is not None else None
    estado = _estado_zona(humedad, hmin_f, hmax_f, sin_conexion, planta is not None, zona_estado == 'pausada')

    temp_str = "—"
    if tmin is not None and tmax is not None:
        temp_str = f"{float(tmin):.0f}–{float(tmax):.0f} °C"

    return {
        "id": id_zona,
        "nombre": nombre_zona,
        "estado_zona": zona_estado,
        "estado": estado,
        "nodo": {
            "nombre": nombre_nodo or nombre_zona,
            "en_linea": not sin_conexion,
            "ultima_conexion": _fmt_ts(ultima_conexion),
        },
        "planta": {
            "id": id_planta,
            "nombre": planta,
            "cientifico": cientifico or "—",
            "categoria": categoria or "—",
            "uso": uso or "—",
            "agua": necesidad_agua or "—",
            "descripcion": descripcion or "—",
            "cuidado": notas_cuidado or "—",
            "luz": luz or "—",
            "temperatura": temp_str,
            "rango": [hmin_f, hmax_f],
            "imagen": imagen_ruta,
            "credito": imagen_credito or "Fuente no registrada",
        } if planta else None,
        "ultima_lectura": {
            "timestamp": _fmt_ts(ultima[4]) if ultima else None,
            "humedad_pct": float(ultima[0]) if ultima else None,
            "temperatura_ambiente": float(ultima[1]) if ultima and ultima[1] else None,
            "humedad_ambiente": float(ultima[2]) if ultima and ultima[2] else None,
            "voltaje_bateria": float(ultima[3]) if ultima and ultima[3] else None,
        },
        "alertas": [
            {
                "id": a[0],
                "tipo": a[1],
                "tipo_label": _TIPO_LABEL.get(a[1], a[1]),
                "abierta": a[2],
                "timestamp_apertura": _fmt_ts(a[3]),
                "timestamp_cierre": _fmt_ts(a[4]),
            }
            for a in alertas
        ],
    }


# ── GET /api/zonas/{id}/estadisticas ─────────────────────────────────────────

@router.get("/api/zonas/{id_zona}/estadisticas", summary="Estadísticas de una zona", tags=["Zonas"])
async def estadisticas_zona(id_zona: int, periodo: str = Query("24h", pattern="^(24h|7d)$")):
    """
    Devuelve la serie de lecturas del periodo junto con el rango de la planta
    vigente en cada momento.  El frontend calcula las coordenadas SVG.
    """
    async with db.pool.connection() as conn:
        exists = await (await conn.execute(
            "SELECT id_zona FROM zona WHERE id_zona = %s", (id_zona,)
        )).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Zona no encontrada.")

        desde = datetime.now(timezone.utc) - (timedelta(hours=24) if periodo == "24h" else timedelta(days=7))

        lecturas = await (await conn.execute(
            """
            SELECT l.timestamp, l.humedad_pct,
                   (SELECT p.humedad_min FROM zona_planta zp2
                    JOIN planta p ON p.id_planta = zp2.id_planta
                    WHERE zp2.id_zona = %s
                      AND zp2.fecha_inicio <= l.timestamp
                      AND (zp2.fecha_fin IS NULL OR zp2.fecha_fin > l.timestamp)
                    LIMIT 1) AS hmin,
                   (SELECT p.humedad_max FROM zona_planta zp2
                    JOIN planta p ON p.id_planta = zp2.id_planta
                    WHERE zp2.id_zona = %s
                      AND zp2.fecha_inicio <= l.timestamp
                      AND (zp2.fecha_fin IS NULL OR zp2.fecha_fin > l.timestamp)
                    LIMIT 1) AS hmax
            FROM lectura l
            JOIN nodo n ON n.id_nodo = l.id_nodo
            WHERE n.id_zona = %s
              AND l.timestamp >= %s
            ORDER BY l.timestamp ASC
            """,
            (id_zona, id_zona, id_zona, desde),
        )).fetchall()

    puntos = [
        {
            "timestamp": _fmt_ts(r[0]),
            "humedad_pct": float(r[1]),
            "hmin": float(r[2]) if r[2] is not None else None,
            "hmax": float(r[3]) if r[3] is not None else None,
        }
        for r in lecturas
    ]

    # Estadísticas de tiempo en rango
    en_rango = sum(1 for p in puntos if p["hmin"] is not None and p["hmin"] <= p["humedad_pct"] <= p["hmax"])
    total = len(puntos)
    horas_periodo = 24 if periodo == "24h" else 168
    tiempo_rango_pct = round(en_rango / total * 100) if total else None
    horas_fuera = round((total - en_rango) / total * horas_periodo, 1) if total else None

    return {
        "periodo": periodo,
        "total_lecturas": total,
        "tiempo_en_rango_pct": tiempo_rango_pct,
        "horas_fuera_rango": horas_fuera,
        "puntos": puntos,
    }


# ── PUT /api/zonas/{id}/planta ────────────────────────────────────────────────

class AsignarPlantaIn(BaseModel):
    id_planta: int | None


@router.put("/api/zonas/{id_zona}/planta", summary="Asignar o quitar planta de una zona", tags=["Zonas"])
async def asignar_planta(id_zona: int, body: AsignarPlantaIn):
    async with db.pool.connection() as conn:
        zona = await (await conn.execute(
            "SELECT id_zona FROM zona WHERE id_zona = %s", (id_zona,)
        )).fetchone()
        if not zona:
            raise HTTPException(status_code=404, detail="Zona no encontrada.")

        if body.id_planta is not None:
            planta = await (await conn.execute(
                "SELECT id_planta FROM planta WHERE id_planta = %s AND activa = TRUE", (body.id_planta,)
            )).fetchone()
            if not planta:
                raise HTTPException(status_code=404, detail="Planta no encontrada o inactiva.")

        async with conn.transaction():
            # Cerrar asignación vigente
            await conn.execute(
                "UPDATE zona_planta SET fecha_fin = NOW() WHERE id_zona = %s AND fecha_fin IS NULL",
                (id_zona,),
            )
            # Abrir nueva si se especificó planta
            if body.id_planta is not None:
                await conn.execute(
                    "INSERT INTO zona_planta (id_zona, id_planta, fecha_inicio) VALUES (%s, %s, NOW())",
                    (id_zona, body.id_planta),
                )

    logger.info("Zona %d: planta cambiada a id=%s", id_zona, body.id_planta)
    return {"ok": True, "id_zona": id_zona, "id_planta": body.id_planta}


# ── PATCH /api/zonas/{id} ─────────────────────────────────────────────────────

class ZonaEstadoIn(BaseModel):
    estado: str

    @field_validator("estado")
    @classmethod
    def estado_valido(cls, v: str) -> str:
        if v not in ("activa", "pausada"):
            raise ValueError("estado debe ser 'activa' o 'pausada'")
        return v


@router.patch("/api/zonas/{id_zona}", summary="Cambiar estado de una zona", tags=["Zonas"])
async def cambiar_estado_zona(id_zona: int, body: ZonaEstadoIn):
    async with db.pool.connection() as conn:
        result = await conn.execute(
            "UPDATE zona SET estado = %s WHERE id_zona = %s", (body.estado, id_zona)
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Zona no encontrada.")

    return {"ok": True, "id_zona": id_zona, "estado": body.estado}
