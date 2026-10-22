---
name: Revisión de calidad
description: Lista de comprobacion para revisar seguridad, robustez, arquitectura y consistencia del codigo en TaskFlow
---

# Revision de calidad

Procedimiento para el subagente revisor. No se modifica codigo; se documentan hallazgos accionables.

## Proceso

1. Cargar el proyecto completo (`server.js`, `src/`, `public/`, `tests/`) leyendo cada archivo, no solo grep.
2. Ejecutar la suite de pruebas (`node --test tests/`) y una muestra `curl` del contrato real.
3. Comparar contrato (`docs/ESPECIFICACION_API.md`) vs rutas implementadas vs llamadas del frontend.
4. Entregar informe por severidad.

## Seguridad

- [ ] SQL: todas las consultas con `prepare('... ?')`; cero concatenacion de entrada de usuario.
- [ ] Validacion de entrada en la capa HTTP (titulo, enums, campos extra) aunque la base ya tenga `CHECK`.
- [ ] XsS: el frontend puebla con `textContent`/`createElement`; `innerHTML` solo con cadenas fijas.
- [ ] Errores 500: sin `err.message`/stack filtrado al cliente; `db` no guarda credenciales.
- [ ] Limites de peticion (`express.json({ limit })`) y rutas estaticas sin `..`.

## Robustez

- [ ] `createApp()` no escucha puerto (pruebas pueden importar la app).
- [ ] `TASKFLOW_DB` respetado; carpeta `data/` se crea, no requiere preparacion manual.
- [ ] Cada ruta devuelve el codigo exacto del contrato (404/400/204/201...).
- [ ] `updated_at` actualizado en PUT/PATCH.
- [ ] `get()` sin filas tratado como 404; DELETE inexistente devuelve 404.
- [ ] Middleware 404 para `/api/**` y manejador de errores general.

## Arquitectura y limpieza

- [ ] Separacion app/rutas/db sin ciclos; `db.js` sin logica HTTP.
- [ ] Sin duplicacion: validacion y mapeo fila→objeto reutilizados, no por copia.
- [ ] Fechas ISO consistentes (UTC Z) en API y base.
- [ ] Sin restos temporales (scripts `test-*.mjs` olvidados, `console.log` sueltos en rutas).

## Consistencia frontend-backend

- [ ] Rutas y verbos HTTP idénticos en `app.js` y rutas Express.
- [ ] Formatos esperados: arrays para lista, objeto en detalle, 204 vacío en DELETE.
- [ ] Enums del formulario identicos a `ESTADOS`/`PRIORIDADES`.

## Formato del informe

Tabla final: `Severidad | Hallazgo (archivo:línea) | Accion y subagente responsable`. Ademas: `n hallazgos criticos / importantes / menores`, resumen de pruebas (n pass/fail) y verificacion del contrato. Un hallazgo sin archivo o linea concreta no es valido.
