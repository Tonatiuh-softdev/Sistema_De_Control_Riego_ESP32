-- ============================================================
-- Migración Tarea 2
-- Aplica sobre una base ya creada con schema.sql de Tarea 1.
-- ============================================================

BEGIN;

ALTER TABLE lectura ADD COLUMN IF NOT EXISTS adc_suelo INTEGER;
UPDATE lectura SET adc_suelo = 0 WHERE adc_suelo IS NULL;
ALTER TABLE lectura ALTER COLUMN adc_suelo SET NOT NULL;

ALTER TABLE alerta DROP CONSTRAINT IF EXISTS alerta_tipo_check;
ALTER TABLE alerta
    ADD CONSTRAINT alerta_tipo_check
    CHECK (tipo IN (
        'humedad_baja', 'sobrehumedad', 'sin_reporte',
        'bateria_baja', 'lectura_invalida'
    ));

COMMIT;
