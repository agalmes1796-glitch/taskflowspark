---
name: API REST con Express
description: Buenas practicas para la API REST de TaskFlow con Node.js y Express: estructura, rutas, validaciones, errores y codigos de estado
---

# API REST con Express

Patrones para el backend de TaskFlow. Objetivo: API pequena, sin dependencias innecesarias y facil de probar.

## Estructura del modulo

- `backend/server.js` arranca el servidor: `import { createApp } from './src/app.js'` y `app.listen(PORT)`.
- `createApp()` devuelve la app Express SIN escuchar un puerto. Las pruebas necesitan importar la app y escucharla ellas mismas en `port 0` (puerto libre). Este patron es obligatorio.
- Rutas de negocio en `backend/src/routes.js` con `express.Router()`, montadas en `app.use('/api', routes)`.
- Solo dos dependencias: `express` y el modulo nativo `node:sqlite` (via `src/db.js`).

## Middleware y estaticos

```js
app.use(express.json({ limit: '64kb' }));
app.use(express.static(new URL('../../public', import.meta.url).pathname));
```

Al final, despues de las rutas, un manejador `404` para `/api/**` y un manejador de errores con cuatro argumentos que no filtre informacion al cliente.

## Codigos de estado (regla fija)

| Situacion | Respuesta |
| --- | --- |
| GET lista/detalle | `200` con JSON |
| POST valido | `201` con el recurso creado |
| PUT/PATCH valido | `200` con el recurso actualizado |
| DELETE valido | `204` sin cuerpo |
| Entrada invalida | `400` con `{ "error": "..." }` |
| Recurso inexistente | `404` con `{ "error": "..." }` |
| Error inesperado | `500` con `{ "error": "error interno del servidor" }` |

## Validacion sin librerias

Funciones puras por recurso, reutilizables:

```js
const ESTADOS = ['pendiente', 'en_progreso', 'completada'];
const PRIORIDADES = ['alta', 'media', 'baja'];

export function validarTarea(datos, { parcial = false } = {}) {
  const errores = [];
  if (!parcial || datos.titulo !== undefined) {
    const t = (datos.titulo ?? '').toString().trim();
    if (t.length < 3 || t.length > 120) errores.push('titulo: entre 3 y 120 caracteres');
  }
  if (datos.estado !== undefined && !ESTADOS.includes(datos.estado))
    errores.push(`estado: uno de ${ESTADOS.join(', ')}`);
  if (datos.prioridad !== undefined && !PRIORIDADES.includes(datos.prioridad))
    errores.push(`prioridad: una de ${PRIORIDADES.join(', ')}`);
  if (Object.keys(datos).some(k => !['titulo', 'descripcion', 'estado', 'prioridad'].includes(k)))
    errores.push('campos no reconocidos');
  return errores;
}
```

No hacer `undefined` trampa en PUT: PUT es reemplazo completo (valida el recurso completo), PATCH permite campos parciales.

## Manejo de errores

- En handlers, `try/catch` alrededor de llamadas a `db.js`; errores de validacion → `400`, errores conocidos → `404`, el resto pasa al middleware de error (`next(err)`).
- Nunca devolver `err.message` del driver en errores 500.

## Scripts y ejecucion

`backend/package.json`: `"type": "module"`, script `"start": "node server.js"`. El puerto se lee de `process.env.PORT` con fallback `3000`. La base se define por `process.env.TASKFLOW_DB` (la gestiona `db.js`).

## Comprobacion antes de cerrar

Arrancar el servidor y probar con `curl` cada endpoint del contrato, mostrando codigos de estado reales. Si un endpoint falla, corregirlo y repetir hasta que el informe incluya solo resultados correctos.
