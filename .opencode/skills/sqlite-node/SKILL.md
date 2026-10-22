---
name: SQLite con node:sqlite
description: Modelo de datos y acceso con el modulo nativo node:sqlite para TaskFlow: esquema, helpers, consultas preparadas y pruebas aisladas
---

# SQLite con node:sqlite

Modulo nativo de Node 24: `import { DatabaseSync } from 'node:sqlite'` (sin paquetes ni flags). API sincronica.

## Patron de conexion (obligatorio en db.js)

```js
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DB_PATH = process.env.TASKFLOW_DB ?? join(dir, '..', 'data', 'taskflow.db');

export function abrirBaseDatos() {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(readFileSync(join(dir, '..', 'schema.sql'), 'utf8')); // idempotente
  return db;
}
```

Un solo `DatabaseSync` reutilizado (modulo con instancia singleton perezosa). Crear una conexion nueva en cada peticion es un error de rendimiento y de locks.

## Esquema de TaskFlow

```sql
CREATE TABLE IF NOT EXISTS tareas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo      TEXT NOT NULL CHECK (length(titulo) BETWEEN 3 AND 120),
  descripcion TEXT NOT NULL DEFAULT '',
  prioridad   TEXT NOT NULL DEFAULT 'media' CHECK (prioridad IN ('alta','media','baja')),
  estado      TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_progreso','completada')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_tareas_estado ON tareas(estado);
```

Las restricciones `CHECK` son la ultima linea de defensa: el codigo tambien debe validar (mejor mensaje de error).

## Consultas: siempre preparadas

```js
const filas = db.prepare('SELECT * FROM tareas WHERE estado = ? ORDER BY id DESC').all(estado);
const info = db.prepare('INSERT INTO tareas (titulo, descripcion, prioridad, estado) VALUES (?, ?, ?, ?)')
  .run(titulo, descripcion, prioridad, estado);
```

- `prepare` con `?` evita inyeccion SQL; jamas concatenar entrada de usuario en SQL.
- `run()` devuelve `{ changes, lastInsertRowid }`; convertir `lastInsertRowid` a `Number(...)` si se usa para un SELECT posterior.
- `get()` devuelve `undefined` si no hay fila: tratarlo siempre como 404 en la capa superior.

## Mapeo a JSON del contrato

Convierte las filas a objetos camelCase del contrato; `id` numerico; fechas como `created_at`/`updated_at` (cadenas ISO `YYYY-MM-DDTHH:MM:SSZ`).

## Actualizacion y fechas

`UPDATE tareas SET ..., updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?` y devolver la fila resultante. Opciones validas `updated_at` para cada campo editable.

## Operaciones dentro de una transaccion

Para escrituras multiples inseparables: `db.exec('BEGIN')`, operaciones, `db.exec('COMMIT')`, con `ROLLBACK` en el `catch`.

## Pruebas aisladas

Todo test DEBE correr con `TASKFLOW_DB` apuntando a un archivo temporal propio (la implementacion respeta esa variable). Consecuencia: `db.js` NO puede abrir la base al cargarse mediante `import` global con efectos laterales; se abre a demanda.

## Comprobacion antes de cerrar

Ejecutar una prueba manual (script temporal desechable) que cree, liste, actualice y borre, verificando `changes`/`lastInsertRowid` y que `updated_at` cambia.
