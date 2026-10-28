# Sistema de control de riego ESP32

Sistema IoT de monitoreo de humedad de plantas en tiempo real. Cuatro nodos ESP32 con sensor capacitivo y DHT11 envían lecturas por WiFi a un servidor local que las guarda en PostgreSQL, compara la humedad con el rango de cada planta, genera alertas y sirve una aplicación web.

## Backend

El servidor corre en Python 3.11 o superior con FastAPI y Uvicorn. Sirve tanto la API REST como la aplicación web estática. Todo funciona dentro de la red local; no requiere internet ni inicio de sesión.

### Prerrequisitos

- Python 3.11 o superior
- PostgreSQL 15 o superior
- El cliente `psql` disponible en la terminal
- Git

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd Sistema_De_Control_Riego_ESP32
```

### 2. Crear la base de datos y el usuario

Ejecutar **una sola vez** como superusuario de PostgreSQL:

```bash
sudo -u postgres psql -c "CREATE ROLE riego_user LOGIN PASSWORD 'tu_contraseña';"
sudo -u postgres createdb -O riego_user riego_iot
sudo -u postgres psql -d riego_iot -c "GRANT ALL ON SCHEMA public TO riego_user;"
```

> En Windows usa pgAdmin o la consola de PostgreSQL con el usuario `postgres`.

### 3. Cargar los scripts SQL

El orden importa: primero el esquema y luego los datos iniciales.

```bash
psql -h localhost -U riego_user -d riego_iot -f backend/sql/schema.sql
psql -h localhost -U riego_user -d riego_iot -f backend/sql/datos_iniciales.sql
```

Esto crea las 8 tablas y carga la configuración, 6 categorías, 9 plantas, 4 zonas y 4 nodos con su calibración.

### 4. Crear el archivo .env

```bash
cp .env.example .env
```

Editar `.env` con los datos reales de conexión:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=riego_iot
DB_USER=riego_user
DB_PASSWORD=tu_contraseña
```

El archivo `.env` nunca se sube al repositorio (está en `.gitignore`).

### 5. Crear el entorno virtual e instalar dependencias

```bash
python -m venv .venv

# Linux / Mac:
source .venv/bin/activate

# Windows:
.venv\Scripts\activate

pip install -r backend/requirements.txt
```

### 6. Arrancar el servidor

```bash
cd backend
../.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
```

> Si el entorno virtual está activo puedes usar `uvicorn main:app --host 0.0.0.0 --port 8000` directamente.  
> Agrega `--reload` durante el desarrollo para recargar automáticamente al guardar cambios.

El servidor queda disponible en:
- **Laptop:** `http://localhost:8000`
- **Celular u otro dispositivo en la misma red:** `http://<IP-de-la-laptop>:8000`

Para conocer la IP local: `ip a` en Linux/Mac, `ipconfig` en Windows.

### 7. Abrir el puerto en el firewall (solo Windows)

Si el celular no puede conectarse desde la misma red:

```
Panel de control → Firewall de Windows Defender
→ Reglas de entrada → Nueva regla → Puerto → TCP 8000 → Permitir la conexión
```

### 8. Verificar que todo funciona

```bash
# El servidor responde:
curl http://localhost:8000/api/salud
# → {"estado":"ok","base_de_datos":"conectada"}

# La documentación interactiva de la API:
# http://localhost:8000/docs
```

---

## Migraciones (base de datos ya existente)

Si ya tenías la base creada de una tarea anterior, aplica solo las migraciones que falten:

```bash
# Tarea 2: añade columna adc_suelo en lectura y tipo lectura_invalida en alerta
psql -h localhost -U riego_user -d riego_iot -f backend/sql/migrate_t2.sql

# Tarea 3: añade columna estado en zona y UNIQUE en nombre_cientifico de planta
psql -h localhost -U riego_user -d riego_iot -f backend/sql/migrate_t3.sql
```

---

## Simular lecturas de los nodos (prueba sin ESP32)

Puedes enviar lecturas de prueba con `curl` o desde `/docs`:

```bash
# Nodo 1 — Monstera (ADC 2665 → ~50 % de humedad)
curl -X POST http://localhost:8000/api/lecturas \
  -H "Content-Type: application/json" \
  -d '{"mac":"D8:BF:C0:80:1A:78","adc_suelo":2665,"temperatura":24.1,"humedad_aire":61.0,"bateria_v":3.82}'

# Nodo 2 — Albahaca (ADC 2600 → ~52 %)
curl -X POST http://localhost:8000/api/lecturas \
  -H "Content-Type: application/json" \
  -d '{"mac":"38:3E:51:6F:0C:9C","adc_suelo":2600,"temperatura":24.0,"humedad_aire":62.0,"bateria_v":3.70}'

# Nodo 3 — Helecho (ADC 2025 → ~77 %)
curl -X POST http://localhost:8000/api/lecturas \
  -H "Content-Type: application/json" \
  -d '{"mac":"38:3E:51:6E:77:D8","adc_suelo":2025,"temperatura":23.5,"humedad_aire":65.0,"bateria_v":3.78}'

# Nodo 4 — Sin planta (ADC 2500 → ~54 %)
curl -X POST http://localhost:8000/api/lecturas \
  -H "Content-Type: application/json" \
  -d '{"mac":"D8:BF:C0:80:11:D0","adc_suelo":2500,"temperatura":25.0,"humedad_aire":55.0,"bateria_v":3.85}'
```

Después abre `http://localhost:8000` para ver el panel actualizado.

---

## Endpoints principales de la API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/salud` | Estado del servidor y la base |
| GET | `/api/panel` | Panel de las 4 zonas con resumen |
| POST | `/api/lecturas` | Recibir lectura de un nodo ESP32 |
| GET | `/api/zonas/{id}` | Ficha completa de una zona |
| GET | `/api/zonas/{id}/estadisticas?periodo=24h\|7d` | Serie de humedad con rango histórico |
| PUT | `/api/zonas/{id}/planta` | Asignar o quitar la planta de una zona |
| PATCH | `/api/zonas/{id}` | Activar o pausar una zona |
| GET | `/api/plantas` | Catálogo de plantas (con filtros) |
| POST | `/api/plantas` | Crear planta |
| PUT | `/api/plantas/{id}` | Editar planta |
| DELETE | `/api/plantas/{id}` | Desactivar planta |
| GET | `/api/alertas` | Listar alertas (filtros: estado, zona, tipo) |
| PATCH | `/api/alertas/{id}` | Marcar alerta como resuelta |

La documentación completa con todos los campos y ejemplos está en **`/docs`** (Swagger UI) mientras el servidor esté corriendo.

---

## Estructura del proyecto

```
├── backend/
│   ├── main.py              # App FastAPI, lifespan, routers, handlers
│   ├── config.py            # Lee .env y tabla configuracion
│   ├── db.py                # Pool de conexiones psycopg 3
│   ├── scheduler.py         # Job periódico: nodos sin reporte
│   ├── requirements.txt
│   ├── routers/
│   │   ├── lecturas.py      # POST /api/lecturas
│   │   ├── zonas.py         # Panel, detalle, estadísticas, asignación
│   │   ├── plantas.py       # CRUD catálogo de plantas
│   │   └── alertas.py       # Listar y resolver alertas
│   └── sql/
│       ├── schema.sql        # DDL completo (crear desde cero)
│       ├── datos_iniciales.sql
│       ├── migrate_t2.sql    # Migración incremental tarea 2
│       └── migrate_t3.sql    # Migración incremental tarea 3
├── static/                  # App web (HTML + CSS + JS)
├── .env.example             # Plantilla de variables de entorno
└── .gitignore
```
