---
name: Documentacion tecnica
description: Plantillas y convenciones para README, especificacion de API y documentacion del proyecto TaskFlow, en castellano
---

# Documentacion tecnica

Convenciones para `README.md` y `docs/`. Todo en castellano, sin emojis, desde cero sin humo: cada afirmacion sale del codigo real.

## README.md (estructura fija)

```
# TaskFlow
Una linea que describe el producto.

## Caracteristicas
4-6 viñetas centradas en el usuario.

## Stack tecnico
Tabla o lista: Node.js 24, Express, SQLite (node:sqlite nativo), HTML/CSS/JS.

## Estructura del proyecto
Bloque de arbol con comentarios a la derecha.

## Instalacion y arranque
Requisitos (Node 24+), `npm install` en backend/, `npm start`, abrir http://localhost:3000.
Nota: base SQLite en backend/data/; se autogenera.
Variable dable: PORT, TASKFLOW_DB.

## API
Resumen breve y enlace a docs/ESPECIFICACION_API.md. Tabla metodo|ruta|descripcion.

## Pruebas
`node --test tests/` desde la raiz.
```

## docs/ESPECIFICACION_API.md (plantilla por endpoint)

Para cada endpoint: `### metodo ruta` + descripcion + tabla de parametros + ejemplo de peticion con `curl` y ejemplo de respuesta con JSON, y tabla final de `codigo: cuando ocurre` (incluye 400/404/500). Definir ANTES la forma de error: `{"error": "..."}`.

## Codigo comentado

- Funciones publicas de `src/` con JSDoc breve en castellano (`@param`/`@returns`).
- Nombres consistentes con el contrato (`estado`/`prioridad`, `en_progreso`).
- En `schema.sql` y `db.js`, comentarios explicando DECISIONES (por que este indice, por que WAL), no sintaxis.

## Documentacion de demostracion (DEMOSTRACION)

Una demostracion valida describe: encargo concretado al orquestador → subagentes disparados (con la skill que pidio el encargo) → evidencia real (salida `curl` o pruebas) → hallazgos del revisor → resultado final. Citar el codigo de estado/`pass`/`fail` literal, no interpretado.

## Reglas

1. Nunca documentar comportamiento no verificable en el codigo.
2. Si el codigo cambia, la documentacion cambia en la misma ronda.
3. Un documento que dice `TODO` no esta terminado: borrar esa seccion o hacerla.
4. Idioma: terminos tecnica en ingles permitidos (endpoint, payload), texto en castellano.
