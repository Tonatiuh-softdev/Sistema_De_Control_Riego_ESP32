"""
routers/lecturas.py — POST /api/lecturas
"""

import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator
import config
import db

logger = logging.getLogger(__name__)
router = APIRouter()


class LecturaIn(BaseModel):
    mac: str
    adc_suelo: int
    temperatura: float | None = None
    humedad_aire: float | None = None
    bateria_v: float | None = None

    @field_validator("mac")
    @classmethod
    def mac_upper(cls, v: str) -> str:
        return v.upper().strip()

    @field_validator("adc_suelo")
    @classmethod
    def adc_rango(cls, v: int) -> int:
        if not (0 <= v <= 4095):
            raise ValueError("adc_suelo debe estar entre 0 y 4095")
        return v

    @field_validator("temperatura")
    @classmethod
    def temperatura_rango(cls, v: float | None) -> float | None:
        if v is not None and not (-20 <= v <= 60):
            raise ValueError("temperatura debe estar entre -20 y 60 °C")
        return v

    @field_validator("humedad_aire")
    @classmethod
    def humedad_aire_rango(cls, v: float | None) -> float | None:
        if v is not None and not (0 <= v <= 100):
            raise ValueError("humedad_aire debe estar entre 0 y 100 %")
        return v


def _calcular_humedad_pct(adc_suelo: int, adc_seco: int, adc_agua: int) -> float:
    if adc_seco == adc_agua:
        return 0.0
    pct = (adc_seco - adc_suelo) / (adc_seco - adc_agua) * 100
    return round(max(0.0, min(100.0, pct)), 2)


async def _abrir_alerta(conn, id_zona: int, tipo: str) -> None:
    await conn.execute(
        """
        INSERT INTO alerta (id_zona, tipo, abierta, timestamp_apertura)
        VALUES (%s, %s, TRUE, NOW())
        ON CONFLICT DO NOTHING
        """,
        (id_zona, tipo),
    )


async def _cerrar_alerta(conn, id_zona: int, tipo: str) -> None:
    await conn.execute(
        """
        UPDATE alerta
           SET abierta = FALSE, timestamp_cierre = NOW()
         WHERE id_zona = %s AND tipo = %s AND abierta = TRUE
        """,
        (id_zona, tipo),
    )


@router.post("/api/lecturas", summary="Recibir lectura de un nodo ESP32", tags=["Nodos"])
async def recibir_lectura(body: LecturaIn):
    async with db.pool.connection() as conn:
        async with conn.transaction():
            row = await (await conn.execute(
                "SELECT n.id_nodo, n.id_zona, n.adc_seco, n.adc_agua FROM nodo n WHERE UPPER(n.mac) = %s",
                (body.mac,),
            )).fetchone()

            if row is None:
                raise HTTPException(status_code=404, detail=f"No existe ningún nodo con MAC {body.mac}.")

            id_nodo, id_zona, adc_seco, adc_agua = row

            # Validación de negocio post-Pydantic
            sensor_invalido = (
                (body.temperatura is not None and not (-20 <= body.temperatura <= 60)) or
                (body.humedad_aire is not None and not (0 <= body.humedad_aire <= 100))
            )
            if sensor_invalido:
                await _abrir_alerta(conn, id_zona, "lectura_invalida")
                raise HTTPException(status_code=422, detail="Uno o más valores de sensores están fuera del rango permitido.")

            humedad_pct = _calcular_humedad_pct(body.adc_suelo, adc_seco, adc_agua)

            await conn.execute(
                """
                INSERT INTO lectura (id_nodo, timestamp, adc_suelo, humedad_pct,
                                     temperatura_ambiente, humedad_ambiente, voltaje_bateria)
                VALUES (%s, NOW(), %s, %s, %s, %s, %s)
                """,
                (id_nodo, body.adc_suelo, humedad_pct, body.temperatura, body.humedad_aire, body.bateria_v),
            )

            await conn.execute("UPDATE nodo SET ultima_conexion = NOW() WHERE id_nodo = %s", (id_nodo,))
            await _cerrar_alerta(conn, id_zona, "sin_reporte")

            # Evaluar humedad solo si la zona está activa y tiene planta
            zona_row = await (await conn.execute(
                "SELECT estado FROM zona WHERE id_zona = %s", (id_zona,)
            )).fetchone()

            if zona_row and zona_row[0] == 'activa':
                planta_row = await (await conn.execute(
                    """
                    SELECT p.humedad_min, p.humedad_max FROM zona_planta zp
                    JOIN planta p ON p.id_planta = zp.id_planta
                    WHERE zp.id_zona = %s AND zp.fecha_fin IS NULL AND p.activa = TRUE
                    """,
                    (id_zona,),
                )).fetchone()

                if planta_row:
                    hmin, hmax = float(planta_row[0]), float(planta_row[1])
                    if humedad_pct < hmin:
                        await _abrir_alerta(conn, id_zona, "humedad_baja")
                        await _cerrar_alerta(conn, id_zona, "sobrehumedad")
                    elif humedad_pct > hmax:
                        await _abrir_alerta(conn, id_zona, "sobrehumedad")
                        await _cerrar_alerta(conn, id_zona, "humedad_baja")
                    else:
                        await _cerrar_alerta(conn, id_zona, "humedad_baja")
                        await _cerrar_alerta(conn, id_zona, "sobrehumedad")

            bateria_umbral = config.cfg.get("bateria_baja", 3.3)
            if body.bateria_v is not None:
                if body.bateria_v < bateria_umbral:
                    await _abrir_alerta(conn, id_zona, "bateria_baja")
                else:
                    await _cerrar_alerta(conn, id_zona, "bateria_baja")

    logger.info("Lectura: MAC=%s zona=%d adc=%d humedad=%.1f%%", body.mac, id_zona, body.adc_suelo, humedad_pct)
    return {"ok": True, "siguiente_lectura_s": int(config.cfg.get("intervalo_lectura", 900))}
