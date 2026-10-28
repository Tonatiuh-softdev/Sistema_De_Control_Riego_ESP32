-- ============================================================
-- Migración Tarea 3
-- Aplica sobre una base ya migrada con migrate_t2.sql.
-- ============================================================

BEGIN;

-- 1. Columna estado en zona: 'activa' (por defecto) o 'pausada'
ALTER TABLE zona ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'activa'
    CHECK (estado IN ('activa', 'pausada'));

-- 2. Restricción UNIQUE en nombre_cientifico de planta
ALTER TABLE planta DROP CONSTRAINT IF EXISTS planta_nombre_cientifico_uq;
ALTER TABLE planta ADD CONSTRAINT planta_nombre_cientifico_uq UNIQUE (nombre_cientifico);

COMMIT;
