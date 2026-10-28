-- ============================================================
-- Sistema IoT de control y monitoreo de plantas
-- Datos iniciales: configuracion, categorias, plantas, zonas,
-- nodos con su calibracion y plantas asignadas.
--
-- Ejecutar despues de schema.sql.
-- ============================================================

SET client_encoding = 'UTF8';

BEGIN;

-- ------------------------------------------------------------
-- Configuracion
-- ------------------------------------------------------------
INSERT INTO configuracion (clave, valor, unidad, descripcion) VALUES
    ('intervalo_lectura',   900, 's',   'Tiempo entre lecturas de cada nodo'),
    ('minutos_sin_reporte', 45,  'min', 'Tiempo sin datos para generar la alerta de nodo sin reportar'),
    ('bateria_baja',        3.3, 'V',   'Voltaje por debajo del cual se genera la alerta de batería baja');

-- ------------------------------------------------------------
-- Categorias
-- ------------------------------------------------------------
INSERT INTO categoria_planta (nombre) VALUES
    ('Ornamental de interior'),
    ('Ornamental de exterior'),
    ('Suculenta y cactus'),
    ('Aromática y medicinal'),
    ('Hortaliza'),
    ('Frutal y cultivo');

-- ------------------------------------------------------------
-- Plantas (las 9 que ya tienen imagen en static/imagenes)
-- El resto del catalogo (minimo 50) se agrega con la misma forma.
-- Las fuentes quedan pendientes de registrar.
-- ------------------------------------------------------------
INSERT INTO planta (id_categoria, nombre_comun, nombre_cientifico, uso, necesidad_agua,
                    humedad_min, humedad_max, temperatura_min, temperatura_max, luz,
                    descripcion, notas_cuidado, imagen_ruta, imagen_credito)
VALUES
    ((SELECT id_categoria FROM categoria_planta WHERE nombre = 'Ornamental de interior'),
     'Monstera', 'Monstera deliciosa', 'hogar', 'media', 35, 55, 18, 28, 'semisombra',
     'Le gusta que se seque un poco la capa superior entre riegos; no tolera encharcarse.',
     'Regar cuando la superficie del sustrato comience a secarse y limpiar sus hojas.',
     'imagenes/Monstera.webp', NULL),

    ((SELECT id_categoria FROM categoria_planta WHERE nombre = 'Aromática y medicinal'),
     'Albahaca', 'Ocimum basilicum', 'ambos', 'media-alta', 50, 70, 18, 30, 'sol pleno',
     'Quiere el sustrato húmedo de forma constante, sin encharcar.',
     'Mantener el sustrato húmedo sin encharcar y comprobar el drenaje.',
     'imagenes/Alpahaca.webp', 'Foto: Forest & Kim Starr, CC BY 3.0, Wikimedia Commons'),

    ((SELECT id_categoria FROM categoria_planta WHERE nombre = 'Ornamental de interior'),
     'Helecho', 'Nephrolepis exaltata', 'hogar', 'alta', 60, 80, 18, 26, 'semisombra',
     'Necesita humedad constante; es la planta que menos se debe secar.',
     'Mantener humedad ambiental y evitar el sol directo sobre las frondas.',
     'imagenes/Helecho.webp', NULL),

    ((SELECT id_categoria FROM categoria_planta WHERE nombre = 'Suculenta y cactus'),
     'Aloe vera (sábila)', 'Aloe vera', 'ambos', 'baja', 20, 35, NULL, NULL, 'sol pleno',
     'Necesita luz brillante y riego solo cuando el sustrato se seca bien.',
     NULL, 'imagenes/Aloe vera.webp', NULL),

    ((SELECT id_categoria FROM categoria_planta WHERE nombre = 'Suculenta y cactus'),
     'Echeveria', 'Echeveria spp.', 'hogar', 'baja', 10, 25, NULL, NULL, 'sol pleno',
     'Mucho sol y sustrato arenoso; no mojar la roseta.',
     NULL, 'imagenes/Echeveria.webp', NULL),

    ((SELECT id_categoria FROM categoria_planta WHERE nombre = 'Suculenta y cactus'),
     'Jade', 'Crassula ovata', 'hogar', 'baja', 15, 30, NULL, NULL, 'sol pleno',
     'Luz brillante; tolera la sequía y se pudre si se encharca.',
     NULL, 'imagenes/Jade.webp', NULL),

    ((SELECT id_categoria FROM categoria_planta WHERE nombre = 'Suculenta y cactus'),
     'Haworthia', 'Haworthia spp.', 'hogar', 'baja', 15, 30, NULL, NULL, 'semisombra',
     'Luz brillante sin sol fuerte directo; riego escaso.',
     NULL, 'imagenes/Haworthia.webp', NULL),

    ((SELECT id_categoria FROM categoria_planta WHERE nombre = 'Suculenta y cactus'),
     'Cactus (en general)', 'Cactaceae', 'hogar', 'baja', 5, 20, NULL, NULL, 'sol pleno',
     'Sol pleno y riego muy poco frecuente.',
     NULL, 'imagenes/Cactus.webp', NULL),

    ((SELECT id_categoria FROM categoria_planta WHERE nombre = 'Ornamental de interior'),
     'Lengua de suegra', 'Dracaena trifasciata', 'hogar', 'baja', 15, 30, NULL, NULL, 'semisombra',
     'Tolera la sombra y el descuido; muy resistente. Antes se clasificaba como Sansevieria trifasciata.',
     NULL, 'imagenes/Sansevieria.webp', NULL);

-- ------------------------------------------------------------
-- Zonas (la estructura de 1 m x 2 m dividida en 4)
-- ------------------------------------------------------------
INSERT INTO zona (nombre, area_m2) VALUES
    ('Zona 1', 0.5),
    ('Zona 2', 0.5),
    ('Zona 3', 0.5),
    ('Zona 4', 0.5);

-- ------------------------------------------------------------
-- Nodos con la MAC y la calibracion medidas en las pruebas
-- ------------------------------------------------------------
INSERT INTO nodo (id_zona, mac, nombre, adc_seco, adc_agua) VALUES
    ((SELECT id_zona FROM zona WHERE nombre = 'Zona 1'), 'D8:BF:C0:80:1A:78', 'Nodo 1', 3520, 1809),
    ((SELECT id_zona FROM zona WHERE nombre = 'Zona 2'), '38:3E:51:6F:0C:9C', 'Nodo 2', 3505, 1770),
    ((SELECT id_zona FROM zona WHERE nombre = 'Zona 3'), '38:3E:51:6E:77:D8', 'Nodo 3', 3300, 1650),
    ((SELECT id_zona FROM zona WHERE nombre = 'Zona 4'), 'D8:BF:C0:80:11:D0', 'Nodo 4', 3440, 1715);

-- ------------------------------------------------------------
-- Plantas asignadas (la Zona 4 queda sin planta)
-- ------------------------------------------------------------
INSERT INTO zona_planta (id_zona, id_planta) VALUES
    ((SELECT id_zona FROM zona WHERE nombre = 'Zona 1'),
     (SELECT id_planta FROM planta WHERE nombre_cientifico = 'Monstera deliciosa')),
    ((SELECT id_zona FROM zona WHERE nombre = 'Zona 2'),
     (SELECT id_planta FROM planta WHERE nombre_cientifico = 'Ocimum basilicum')),
    ((SELECT id_zona FROM zona WHERE nombre = 'Zona 3'),
     (SELECT id_planta FROM planta WHERE nombre_cientifico = 'Nephrolepis exaltata'));

COMMIT;