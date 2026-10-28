"""
main.py — Punto de entrada del servidor FastAPI.

Arranca con:
    uvicorn main:app --host 0.0.0.0 --port 8000

Las rutas /api/... se registran antes del montaje de static/ para que
los endpoints no queden tapados por los archivos estáticos.
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException, RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

import config
import db
from routers import lecturas, zonas, plantas, alertas
from scheduler import revisar_nodos_sin_reporte

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Abriendo pool de conexiones...")
    await db.open_pool(config.CONNINFO)

    logger.info("Cargando tabla configuracion...")
    config.cfg.update(await config.load_cfg(db.pool))
    logger.info("Configuración cargada: %s", config.cfg)

    scheduler.add_job(
        revisar_nodos_sin_reporte,
        trigger="interval",
        minutes=1,
        id="nodos_sin_reporte",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler iniciado (job nodos_sin_reporte cada 1 min).")

    yield

    scheduler.shutdown()
    logger.info("Scheduler detenido.")
    await db.close_pool()
    logger.info("Pool cerrado.")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Sistema IoT de riego",
    description="API del sistema de monitoreo de plantas con nodos ESP32.",
    version="0.3.0",
    lifespan=lifespan,
)


# ── Ruta de salud ─────────────────────────────────────────────────────────────
@app.get("/api/salud", summary="Estado del servidor y la base de datos", tags=["Sistema"])
async def salud():
    try:
        async with db.pool.connection() as conn:
            await conn.execute("SELECT 1")
        return {"estado": "ok", "base_de_datos": "conectada"}
    except Exception as exc:
        logger.error("Fallo en /api/salud: %s", exc)
        return JSONResponse(
            status_code=503,
            content={"estado": "error", "base_de_datos": "sin conexión",
                     "detalle": "No se pudo ejecutar una consulta de prueba."},
        )


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(lecturas.router)
app.include_router(zonas.router)
app.include_router(plantas.router)
app.include_router(alertas.router)


# ── Manejadores de error globales ─────────────────────────────────────────────
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    detalle = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return JSONResponse(status_code=exc.status_code, content={"detalle": detalle})


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    detalle = "; ".join(
        e.get("msg", "valor inválido").replace("Value error, ", "")
        for e in errors
    ) or "Los datos enviados no son válidos."

    # Si el error viene de /api/lecturas, abrir alerta lectura_invalida
    if request.url.path == "/api/lecturas":
        try:
            body = await request.json()
            mac = str(body.get("mac", "")).upper().strip()
            if mac and db.pool:
                async with db.pool.connection() as conn:
                    row = await (await conn.execute(
                        "SELECT id_zona FROM nodo WHERE UPPER(mac) = %s", (mac,)
                    )).fetchone()
                    if row:
                        await conn.execute(
                            """
                            INSERT INTO alerta (id_zona, tipo, abierta, timestamp_apertura)
                            VALUES (%s, 'lectura_invalida', TRUE, NOW())
                            ON CONFLICT DO NOTHING
                            """,
                            (row[0],),
                        )
        except Exception as alert_exc:
            logger.error("No se pudo abrir alerta lectura_invalida: %s", alert_exc)

    return JSONResponse(status_code=422, content={"detalle": detalle})


# ── Archivos estáticos (DESPUÉS de las rutas /api/) ───────────────────────────
_static_dir = Path(__file__).parent.parent / "static"
app.mount("/", StaticFiles(directory=str(_static_dir), html=True), name="static")
