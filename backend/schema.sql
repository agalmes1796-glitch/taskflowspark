-- TaskFlow · esquema de la base de datos (SQLite)
-- Idempotente: puede ejecutarse varias veces sobre el mismo archivo.

CREATE TABLE IF NOT EXISTS tareas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo      TEXT NOT NULL CHECK (length(titulo) BETWEEN 3 AND 120),
  descripcion TEXT NOT NULL DEFAULT '',
  prioridad   TEXT NOT NULL DEFAULT 'media' CHECK (prioridad IN ('alta', 'media', 'baja')),
  estado      TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_progreso', 'completada')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_tareas_estado ON tareas (estado);
