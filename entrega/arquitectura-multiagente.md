# Arquitectura multiagente con OpenCode

## Objetivo
Organizar el desarrollo mediante un agente principal y especialistas que siguen procedimientos reutilizables (skills).

## Componentes
- `orquestador`: analiza, planifica, delega y verifica.
- `analista`: reconoce la arquitectura y propone subtareas sin editar.
- `frontend`: interviene solo si el proyecto tiene interfaz frontend.
- `backend`: interviene solo si existen servicios o lógica backend.
- `datos`: interviene solo si existe persistencia.
- `implementador-python`: implementa cambios Python y Jupyter.
- `testing`: ejecuta y documenta pruebas.
- `documentacion`: redacta documentación y evidencias.

## Skills
- `analisis-proyecto`: inspección inicial y planificación.
- `desarrollo-python`: implementación y validación Python.
- `calidad-notebooks`: cuidado y validación de notebooks.
- `testing`: pruebas reproducibles.
- `documentacion`: documentación basada en hechos.

## Flujo previsto
Petición -> análisis -> plan -> delegación a especialistas -> pruebas -> revisión del orquestador -> evidencias.

## Estado de verificación
Los archivos de configuración describen el comportamiento esperado. La delegación efectiva, la carga real de skills y el funcionamiento del cambio deben demostrarse mediante una ejecución real y registrarse en `evidencias.md`.
