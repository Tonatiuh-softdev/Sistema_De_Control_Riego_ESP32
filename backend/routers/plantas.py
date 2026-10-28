"""
routers/plantas.py — CRUD de plantas y categorías

GET  /api/categorias
GET  /api/plantas (filtros: categoria, uso, luz, activa, q)
GET  /api/plantas/{id}
POST /api/plantas
PUT  /api/plantas/{id}
DELETE /api/plantas/{id}  → activa = false (409 si asignada)
"""

import logging
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, field_validator
from psycopg.errors import UniqueViolation

import db

logger = logging.getLogger(__name__)
router = APIRouter()


class PlantaIn(BaseModel):
    id_categoria: int
    nombre_comun: str
    nombre_cientifico: str | None = None
    uso: str | None = None
    necesidad_agua: str | None = None
    humedad_min: float
    humedad_max: float
    temperatura_min: float | None = None
    temperatura_max: float | None = None
    luz: str | None = None
    descripcion: str | None = None
    notas_cuidado: str | None = None
    imagen_ruta: str | None = None
    imagen_credito: str | None = None

    @field_validator("humedad_max")
    @classmethod
    def rango_valido(cls, v: float, info) -> float:
        hmin = info.data.get("humedad_min")
        if hmin is not None and v <= hmin:
            raise ValueError("humedad_max debe ser mayor que humedad_min")
        return v

    @field_validator("humedad_min", "humedad_max")
    @classmethod
    def humedad_en_rango(cls, v: float) -> float:
        if not (0 <= v <= 100):
            raise ValueError("El porcentaje de humedad debe estar entre 0 y 100")
        return v


def _row_to_dict(r) -> dict:
    return {
        "id": r[0],
        "id_categoria": r[1],
        "categoria": r[2],
        "nombre_comun": r[3],
        "nombre_cientifico": r[4],
        "uso": r[5],
        "necesidad_agua": r[6],
        "humedad_min": float(r[7]),
        "humedad_max": float(r[8]),
        "temperatura_min": float(r[9]) if r[9] is not None else None,
        "temperatura_max": float(r[10]) if r[10] is not None else None,
        "luz": r[11],
        "descripcion": r[12],
        "notas_cuidado": r[13],
        "imagen_ruta": r[14],
        "imagen_credito": r[15],
        "activa": r[16],
    }


# ── GET /api/categorias ───────────────────────────────────────────────────────

@router.get("/api/categorias", summary="Listar categorías de plantas", tags=["Plantas"])
async def listar_categorias():
    async with db.pool.connection() as conn:
        rows = await (await conn.execute(
            "SELECT id_categoria, nombre FROM categoria_planta ORDER BY nombre"
        )).fetchall()
    return [{"id": r[0], "nombre": r[1]} for r in rows]


# ── GET /api/plantas ──────────────────────────────────────────────────────────

@router.get("/api/plantas", summary="Listar plantas con filtros", tags=["Plantas"])
async def listar_plantas(
    categoria: int | None = Query(None),
    uso: str | None = Query(None),
    luz: str | None = Query(None),
    activa: bool | None = Query(None),
    q: str | None = Query(None, description="Búsqueda por nombre común o científico"),
):
    # Construir filtros de forma segura con parámetros
    condiciones = ["TRUE"]
    params: list = []

    if categoria is not None:
        condiciones.append("p.id_categoria = %s")
        params.append(categoria)
    if uso is not None:
        condiciones.append("p.uso = %s")
        params.append(uso)
    if luz is not None:
        condiciones.append("p.luz = %s")
        params.append(luz)
    if activa is not None:
        condiciones.append("p.activa = %s")
        params.append(activa)
    if q is not None:
        condiciones.append("(LOWER(p.nombre_comun) LIKE LOWER(%s) OR LOWER(p.nombre_cientifico) LIKE LOWER(%s))")
        params.extend([f"%{q}%", f"%{q}%"])

    where = " AND ".join(condiciones)

    async with db.pool.connection() as conn:
        rows = await (await conn.execute(
            f"""
            SELECT p.id_planta, p.id_categoria, cp.nombre AS categoria,
                   p.nombre_comun, p.nombre_cientifico, p.uso, p.necesidad_agua,
                   p.humedad_min, p.humedad_max, p.temperatura_min, p.temperatura_max,
                   p.luz, p.descripcion, p.notas_cuidado, p.imagen_ruta, p.imagen_credito, p.activa
              FROM planta p
              JOIN categoria_planta cp ON cp.id_categoria = p.id_categoria
             WHERE {where}
             ORDER BY p.nombre_comun
            """,
            params,
        )).fetchall()

    return [_row_to_dict(r) for r in rows]


# ── GET /api/plantas/{id} ─────────────────────────────────────────────────────

@router.get("/api/plantas/{id_planta}", summary="Obtener una planta", tags=["Plantas"])
async def obtener_planta(id_planta: int):
    async with db.pool.connection() as conn:
        row = await (await conn.execute(
            """
            SELECT p.id_planta, p.id_categoria, cp.nombre,
                   p.nombre_comun, p.nombre_cientifico, p.uso, p.necesidad_agua,
                   p.humedad_min, p.humedad_max, p.temperatura_min, p.temperatura_max,
                   p.luz, p.descripcion, p.notas_cuidado, p.imagen_ruta, p.imagen_credito, p.activa
              FROM planta p JOIN categoria_planta cp ON cp.id_categoria = p.id_categoria
             WHERE p.id_planta = %s
            """,
            (id_planta,),
        )).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Planta no encontrada.")
    return _row_to_dict(row)


# ── POST /api/plantas ─────────────────────────────────────────────────────────

@router.post("/api/plantas", status_code=201, summary="Crear planta", tags=["Plantas"])
async def crear_planta(body: PlantaIn):
    try:
        async with db.pool.connection() as conn:
            row = await (await conn.execute(
                """
                INSERT INTO planta (id_categoria, nombre_comun, nombre_cientifico, uso,
                    necesidad_agua, humedad_min, humedad_max, temperatura_min, temperatura_max,
                    luz, descripcion, notas_cuidado, imagen_ruta, imagen_credito)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING id_planta
                """,
                (body.id_categoria, body.nombre_comun, body.nombre_cientifico, body.uso,
                 body.necesidad_agua, body.humedad_min, body.humedad_max,
                 body.temperatura_min, body.temperatura_max, body.luz,
                 body.descripcion, body.notas_cuidado, body.imagen_ruta, body.imagen_credito),
            )).fetchone()
    except UniqueViolation:
        raise HTTPException(status_code=409, detail="Ya existe una planta con ese nombre científico.")

    logger.info("Planta creada id=%d: %s", row[0], body.nombre_comun)
    return {"ok": True, "id_planta": row[0]}


# ── PUT /api/plantas/{id} ─────────────────────────────────────────────────────

@router.put("/api/plantas/{id_planta}", summary="Actualizar planta", tags=["Plantas"])
async def actualizar_planta(id_planta: int, body: PlantaIn):
    # Verificar existencia
    async with db.pool.connection() as conn:
        existe = await (await conn.execute(
            "SELECT id_planta FROM planta WHERE id_planta = %s", (id_planta,)
        )).fetchone()
        if not existe:
            raise HTTPException(status_code=404, detail="Planta no encontrada.")

        try:
            await conn.execute(
                """
                UPDATE planta SET
                    id_categoria = %s, nombre_comun = %s, nombre_cientifico = %s,
                    uso = %s, necesidad_agua = %s, humedad_min = %s, humedad_max = %s,
                    temperatura_min = %s, temperatura_max = %s, luz = %s,
                    descripcion = %s, notas_cuidado = %s, imagen_ruta = %s, imagen_credito = %s
                WHERE id_planta = %s
                """,
                (body.id_categoria, body.nombre_comun, body.nombre_cientifico, body.uso,
                 body.necesidad_agua, body.humedad_min, body.humedad_max,
                 body.temperatura_min, body.temperatura_max, body.luz,
                 body.descripcion, body.notas_cuidado, body.imagen_ruta, body.imagen_credito,
                 id_planta),
            )
        except UniqueViolation:
            raise HTTPException(status_code=409, detail="Ya existe una planta con ese nombre científico.")

    return {"ok": True, "id_planta": id_planta}


# ── DELETE /api/plantas/{id} ──────────────────────────────────────────────────

@router.delete("/api/plantas/{id_planta}", summary="Desactivar planta", tags=["Plantas"])
async def desactivar_planta(id_planta: int):
    async with db.pool.connection() as conn:
        existe = await (await conn.execute(
            "SELECT id_planta FROM planta WHERE id_planta = %s", (id_planta,)
        )).fetchone()
        if not existe:
            raise HTTPException(status_code=404, detail="Planta no encontrada.")

        # 409 si está asignada a alguna zona actualmente
        asignada = await (await conn.execute(
            "SELECT id_zona FROM zona_planta WHERE id_planta = %s AND fecha_fin IS NULL", (id_planta,)
        )).fetchone()
        if asignada:
            raise HTTPException(
                status_code=409,
                detail="No se puede desactivar una planta que está asignada a una zona. Cambia la planta de la zona primero."
            )

        await conn.execute("UPDATE planta SET activa = FALSE WHERE id_planta = %s", (id_planta,))

    logger.info("Planta %d desactivada.", id_planta)
    return {"ok": True, "id_planta": id_planta}
