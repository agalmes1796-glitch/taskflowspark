---
name: Testing con node:test
description: Pruebas automatizadas de TaskFlow con el runner nativo node:test, pruebas de integracion HTTP y bases de datos aisladas
---

# Testing con node:test

`node:test` + `node:assert/strict`, sin dependencias. Ejecucion: `node --test tests/`.

## Aislar base de datos y puerto

Patron obligatorio para que dos pruebas o dos ejecuciones no choquen:

```js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../backend/src/app.js';

const antes = process.env.TASKFLOW_DB;
process.env.TASKFLOW_DB = `/tmp/taskflow-test-${process.pid}.db`;
const app = createApp();
const servidor = app.listen(0);          // puerto libre
const base = `http://localhost:${servidor.address().port}`;
```

En `after`: cerrar el servidor, restaurar `process.env.TASKFLOW_DB`, borrar el archivo `TASKFLOW_DB`.

## Una peticion auxiliar

```js
async function api(metodo, ruta, cuerpo) {
  const res = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await res.text();
  return { estado: res.status, datos: texto ? JSON.parse(texto) : null };
}
```

## Qué debe cubrir la suite (criterios del contrato)

1. `GET /api/health` → 200, `{ status: 'ok' }`.
2. POST valido → 201, cuerpo con id numerico, `estado: 'pendiente'`, fechas ISO.
3. GET lista → 200, array con las creadas.
4. GET por id → 200; GET id inexistente → 404 con `{ error }`.
5. PUT valido → 200 y `updated_at` distinto.
6. PATCH estado → 200; PATCH estado invalido → 400.
7. Validaciones: titulo vacio/corto/no-string → 400; prioridad invalida → 400.
8. DELETE → 204 sin cuerpo; GET posterior → 404.
9. Contenido `Content-Type` sin parsear: `GET /api/tareas` devuelve JSON.

## Buenas practicas

- Pruebas independientes: no depender del id o el orden de otra prueba (crear recurso propio).
- Asertos especificos: `assert.equal(respuesta.estado, 201)` y despues `assert.deepEqual` solo del campo que cambia.
- Un solo fallo real por prueba; mensajes descriptivos en assert: `assert.equal(res.estado, 200, `esperaba 200, respuesta: ${JSON.stringify(res.datos)}`)`.
- Casos de error con `assert.match(datos.error, /titulo/i)` para no depender del mensaje exacto.
- Si se detecta defecto, crear UNA prueba que lo reproduzca y dejarla fallando, con comentario `// DEFECTO:` explicando el bug para el informe.

## Como informar resultados

Mostrar literalmente la salida de `node --test tests/` (o su resumen `# pass/fail`) y, si hubo fallos, el texto del error y tu interpretacion. Solo cuenta la evidencia ejecutada, no lo que parece que deberia pasar.
