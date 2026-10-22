---
name: Frontend web vanilla
description: Interfaz de TaskFlow con HTML + CSS + JavaScript sin frameworks, servida estaticamente y consumiendo la API REST de forma segura
---

# Frontend web vanilla

Interfaz de TaskFlow servida por Express desde `public/` (mismo origen que la API). Sin frameworks, sin CDN, sin build.

## Archivos

```
public/
  index.html
  css/styles.css
  js/app.js
```

## Patrón de acceso a la API en app.js

```js
const API = '/api';
async function pedir(ruta, opciones = {}) {
  const res = await fetch(`${API}${ruta}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
  });
  if (res.status === 204) return null;
  const cuerpo = await res.json();
  if (!res.ok) throw new Error(cuerpo.error || `Error ${res.status}`);
  return cuerpo;
}
const API_Tareas = {
  listar: (filtros = '') => pedir(`/tareas${filtros}`),
  crear: (datos) => pedir('/tareas', { method: 'POST', body: JSON.stringify(datos) }),
  actualizar: (id, datos) => pedir(`/tareas/${id}`, { method: 'PUT', body: JSON.stringify(datos) }),
  cambiarEstado: (id, estado) => pedir(`/tareas/${id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado }) }),
  eliminar: (id) => pedir(`/tareas/${id}`, { method: 'DELETE' }),
};
```

`fetch` falla solo con errores de red: el manejo de errores de la API se hace SIEMPRE comprobando `res.ok` y leyendo `{ error }`.

## Seguridad y DOM

- Poblado del DOM con `textContent` y `document.createElement` para cualquier dato venido del usuario. Nada de `innerHTML` con datos dinamicos (XSS).
- Un solo punto de renderizado: `render(tareas)` reconstruye la lista. Evitar parches manuales del DOM dispersos por el codigo.
- Delegacion de eventos: un `click` en la lista con `data-accion`/`data-id`.
- `escape` de datos solo si se construye HTML por plantilla; mejor, no hacerlo nunca.

## Funcionalidad minima

1. Lista con badge de prioridad y selector de estado por fila.
2. Formulario: titulo + descripcion + prioridad. `preventDefault`, limpiar tras crear, recargar la lista.
3. Filtro por estado (`todas/pendiente/en_progreso/completada`) y buscador por titulo (filtro en memoria, recargado desde `listar()`).
4. Boton eliminar con `confirm()`. Estado vacio cuando no hay resultados.
5. Errores visibles: banner con `role="alert"`, no solo en consola.

## Accesibilidad y UX

- `label` asociados con `for/id`; la tabla o lista usa semantica correcta (`li` con `role="listitem"` implicito, `h1` unico).
- Fechas legibles: `new Date(x).toLocaleDateString('es-ES')` o similar.
- CSS simple: layout flexbox, variables CSS para colores por prioridad/estado, adaptable movil con `@media`.
- Animaciones no necesarias; claridad si.

## Comprobacion antes de cerrar

Servir con `node backend/server.js` y verificar: `curl localhost:PORT/` devuelve el HTML, la ruta `js/app.js` responde 200, y cada llamada que hace la pagina coincide con el contrato (`/api/tareas` etc.). Recorrer mentalmente el ciclo crear/listar/filtrar/completar/eliminar.
