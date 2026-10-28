-- ============================================================
-- Sistema IoT de control y monitoreo de plantas
-- DDL completo — schema.sql
--
-- Cargar primero; luego datos_iniciales.sql.
-- Requiere PostgreSQL 15 o superior.
-- ============================================================

SET client_encoding = 'UTF8';

-- ------------------------------------------------------------
-- configuracion
-- Parámetros del sistema leídos al arrancar el servidor.
-- El código Python nunca usa literales para estos valores.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS configuracion (
    clave        TEXT         PRIMARY KEY,
    valor        NUMERIC      NOT NULL,
    unidad       TEXT         NOT NULL,
    descripcion  TEXT         NOT NULL
);

-- ------------------------------------------------------------
-- categoria_planta
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categoria_planta (
    id_categoria  SERIAL  PRIMARY KEY,
    nombre        TEXT    NOT NULL UNIQUE
);

-- ------------------------------------------------------------
-- planta
-- Catálogo de especies con su rango de humedad del suelo.
-- temperatura_min y temperatura_max son opcionales.
-- activa = FALSE oculta la planta en la aplicación web.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS planta (
    id_planta          SERIAL   PRIMARY KEY,
    id_categoria       INTEGER  NOT NULL REFERENCES categoria_planta(id_categoria),
    nombre_comun       TEXT     NOT NULL,
    nombre_cientifico  TEXT,
    uso                TEXT,
    necesidad_agua     TEXT,
    humedad_min        NUMERIC(5,2) NOT NULL
                           CHECK (humedad_min >= 0 AND humedad_min <= 100),
    humedad_max        NUMERIC(5,2) NOT NULL
                           CHECK (humedad_max >= 0 AND humedad_max <= 100),
    temperatura_min    NUMERIC(5,1),
    temperatura_max    NUMERIC(5,1),
    luz                TEXT,
    descripcion        TEXT,
    notas_cuidado      TEXT,
    imagen_ruta        TEXT,
    imagen_credito     TEXT,
    activa             BOOLEAN  NOT NULL DEFAULT TRUE,
    CONSTRAINT humedad_rango_valido CHECK (humedad_max > humedad_min),
    CONSTRAINT planta_nombre_cientifico_uq UNIQUE (nombre_cientifico)
);

-- ------------------------------------------------------------
-- zona
-- Las 4 zonas físicas del sistema.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS zona (
    id_zona   SERIAL        PRIMARY KEY,
    nombre    TEXT          NOT NULL UNIQUE,
    area_m2   NUMERIC(6,2),
    estado    TEXT          NOT NULL DEFAULT 'activa'
                  CHECK (estado IN ('activa', 'pausada'))
);

-- ------------------------------------------------------------
-- zona_planta
-- Historial de asignaciones planta↔zona.
-- Solo puede haber una asignación activa (fecha_fin IS NULL)
-- por zona en cada momento; el índice parcial lo garantiza.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS zona_planta (
    id_zona_planta  SERIAL       PRIMARY KEY,
    id_zona         INTEGER      NOT NULL REFERENCES zona(id_zona),
    id_planta       INTEGER      NOT NULL REFERENCES planta(id_planta),
    fecha_inicio    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    fecha_fin       TIMESTAMPTZ,
    CONSTRAINT fechas_validas CHECK (
        fecha_fin IS NULL OR fecha_fin > fecha_inicio
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS zona_planta_activa_uq
    ON zona_planta (id_zona)
    WHERE fecha_fin IS NULL;

-- ------------------------------------------------------------
-- nodo
-- Un nodo ESP32 por zona.  mac es la dirección MAC del ESP32.
-- adc_seco y adc_agua son los valores de calibración de la
-- sonda capacitiva medidos al aire y sumergida en agua.
-- ultima_conexion se actualiza cada vez que llega una lectura.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nodo (
    id_nodo            SERIAL       PRIMARY KEY,
    id_zona            INTEGER      NOT NULL UNIQUE REFERENCES zona(id_zona),
    mac                TEXT         NOT NULL UNIQUE,
    nombre             TEXT,
    adc_seco           INTEGER      NOT NULL,
    adc_agua           INTEGER      NOT NULL,
    ultima_conexion    TIMESTAMPTZ,
    CONSTRAINT adc_valido CHECK (adc_seco > adc_agua)
);

-- ------------------------------------------------------------
-- lectura
-- Serie de tiempo de sensores.
-- El porcentaje de humedad se calcula en el servidor con la
-- calibración del nodo; el nodo envía el valor crudo del ADC
-- y el servidor lo convierte.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lectura (
    id_lectura            BIGSERIAL    PRIMARY KEY,
    id_nodo               INTEGER      NOT NULL REFERENCES nodo(id_nodo),
    timestamp             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    adc_suelo             INTEGER      NOT NULL,
    humedad_pct           NUMERIC(5,2) NOT NULL
                              CHECK (humedad_pct >= 0 AND humedad_pct <= 100),
    temperatura_ambiente  NUMERIC(5,2),
    humedad_ambiente      NUMERIC(5,2),
    voltaje_bateria       NUMERIC(5,3)
);

CREATE INDEX IF NOT EXISTS lectura_nodo_ts_idx
    ON lectura (id_nodo, timestamp DESC);

-- ------------------------------------------------------------
-- alerta
-- tipo: humedad_baja | sobrehumedad | sin_reporte | bateria_baja
-- El índice parcial impide dos alertas abiertas del mismo tipo
-- en la misma zona.  El servidor cierra la alerta (abierta = FALSE,
-- timestamp_cierre = NOW()) cuando la condición se resuelve.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerta (
    id_alerta           BIGSERIAL    PRIMARY KEY,
    id_zona             INTEGER      NOT NULL REFERENCES zona(id_zona),
    tipo                TEXT         NOT NULL
                            CHECK (tipo IN (
                                'humedad_baja',
                                'sobrehumedad',
                                'sin_reporte',
                                'bateria_baja',
                                'lectura_invalida'
                            )),
    abierta             BOOLEAN      NOT NULL DEFAULT TRUE,
    timestamp_apertura  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    timestamp_cierre    TIMESTAMPTZ,
    CONSTRAINT cierre_valido CHECK (
        timestamp_cierre IS NULL OR timestamp_cierre >= timestamp_apertura
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS alerta_abierta_uq
    ON alerta (id_zona, tipo)
    WHERE abierta = TRUE;

CREATE INDEX IF NOT EXISTS alerta_zona_idx
    ON alerta (id_zona, abierta, timestamp_apertura DESC);
