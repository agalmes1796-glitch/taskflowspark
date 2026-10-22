/**
 * TaskFlow — capa de acceso a datos (SQLite con `node:sqlite`).
 *
 * Convenciones del modulo:
 *  - Solo expone helpers de acceso; no hay logica HTTP ni dependencias externas.
 *  - La ruta del archivo se resuelve A DEMANDA desde `process.env.TASKFLOW_DB`
 *    (por defecto `backend/data/taskflow.db`). Gracias a esto las pruebas pueden
 *    apuntar a una base propia y aislada.
 *  - Importar este modulo NO tiene efectos laterales: la conexion es un
 *    singleton perezoso que se abre en el primer acceso (`obtenerConexion`).
 *  - Al abrir la conexion se ejecuta `schema.sql` (idempotente) y se crean
 *    las carpetas que falten.
 *  - Los helpers devuelven objetos con claves camelCase y fechas ISO UTC
 *    (`createdAt` / `updatedAt`), nunca filas crudas. "No encontrada" se traduce
 *    a `null` (o `false` al eliminar); los argumentos malformados lanzan
 *    `TypeError` para que la capa HTTP responda 400.
 */

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR_MODULO = dirname(fileURLToPath(import.meta.url)); // backend/src
const RAIZ_BACKEND = join(DIR_MODULO, '..'); // backend
const RUTA_ESQUEMA = join(RAIZ_BACKEND, 'schema.sql');
const RUTA_POR_DEFECTO = join(RAIZ_BACKEND, 'data', 'taskflow.db');

export const ESTADOS = Object.freeze(['pendiente', 'en_progreso', 'completada']);
export const PRIORIDADES = Object.freeze(['alta', 'media', 'baja']);
const TITULO_MINIMO = 3;
const TITULO_MAXIMO = 120;

const SQL = Object.freeze({
  listar: `SELECT id, titulo, descripcion, prioridad, estado, created_at, updated_at
             FROM tareas
            WHERE (:estado IS NULL OR estado = :estado)
              AND (:q IS NULL OR titulo LIKE :q ESCAPE '\\')
            ORDER BY id DESC`,
  obtener: `SELECT id, titulo, descripcion, prioridad, estado, created_at, updated_at
              FROM tareas
             WHERE id = ?`,
  crear: `INSERT INTO tareas (titulo, descripcion, prioridad, estado)
          VALUES (?, ?, ?, ?)`,
  // `COALESCE(?, columna)` permite actualizar solo los campos informados.
  actualizar: `UPDATE tareas
                  SET titulo      = COALESCE(?, titulo),
                      descripcion = COALESCE(?, descripcion),
                      prioridad   = COALESCE(?, prioridad),
                      estado      = COALESCE(?, estado),
                      updated_at  = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
                WHERE id = ?`,
  eliminar: 'DELETE FROM tareas WHERE id = ?',
});

/** Singleton perezoso: una unica conexion reutilizada (nada de abrir en cada peticion). */
let conexion = null;
let rutaAbierta = null;

/** Ruta efectiva de la base de datos en este instante (respeta TASKFLOW_DB). */
export function rutaBaseDatos() {
  const valor = process.env.TASKFLOW_DB;
  return valor && valor.trim() !== '' ? resolve(valor) : RUTA_POR_DEFECTO;
}

/**
 * Abre una conexion nueva: carpeta, fichero, pragmas y esquema.
 * No registra la conexion como singleton; quien lo hace es `obtenerConexion`.
 */
export function abrirBaseDatos() {
  const ruta = rutaBaseDatos();
  mkdirSync(dirname(ruta), { recursive: true });

  const db = new DatabaseSync(ruta);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(readFileSync(RUTA_ESQUEMA, 'utf8')); // idempotente
  return db;
}

/** Devuelve la conexion en curso, abriendola si todavia no existe. */
export function obtenerConexion() {
  const ruta = rutaBaseDatos();
  if (conexion !== null && rutaAbierta === ruta) return conexion;

  // Cambió TASKFLOW_DB (p. ej. entre ficheros de prueba): se redirige la conexion.
  if (conexion !== null) {
    conexion.close();
    conexion = null;
    rutaAbierta = null;
  }
  conexion = abrirBaseDatos();
  rutaAbierta = ruta;
  return conexion;
}

/** Cierra la conexion compartida. Util para cortes limpios y pruebas. */
export function cerrarBaseDatos() {
  if (conexion !== null) {
    conexion.close();
    conexion = null;
    rutaAbierta = null;
  }
}

/* ------------------------------------------------------------------ *
 * Validacion y mapeo
 * ------------------------------------------------------------------ */

function error(mensaje) {
  return new TypeError(mensaje);
}

function normalizarId(valor, nombre = 'id') {
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isInteger(numero) || numero < 1) {
    throw error(`«${nombre}» debe ser un entero positivo (recibido: ${JSON.stringify(valor)})`);
  }
  return numero;
}

function normalizarTexto(valor, nombre, { minimo = 0, maximo = Number.POSITIVE_INFINITY, obligatorio = false } = {}) {
  if (valor === undefined || valor === null) {
    if (obligatorio) throw error(`«${nombre}» es obligatorio`);
    return undefined;
  }
  if (typeof valor !== 'string') throw error(`«${nombre}» debe ser un texto`);
  const texto = valor.trim();
  if (texto.length < minimo) {
    throw error(`«${nombre}» debe tener como minimo ${minimo} caracteres (recibido: ${texto.length})`);
  }
  if (texto.length > maximo) {
    throw error(`«${nombre}» como maximo tiene ${maximo} caracteres (recibido: ${texto.length})`);
  }
  return texto;
}

function validarEnum(valor, opciones, nombre) {
  if (valor === undefined) return undefined;
  if (!opciones.includes(valor)) {
    throw error(`«${nombre}» debe ser uno de ${opciones.join(', ')} (recibido: ${JSON.stringify(valor)})`);
  }
  return valor;
}

/** Convierte una fila de la base al objeto camelCase del contrato. */
function mapearTarea(fila) {
  if (fila === undefined) return null;
  return {
    id: Number(fila.id),
    titulo: fila.titulo,
    descripcion: fila.descripcion ?? '',
    prioridad: fila.prioridad,
    estado: fila.estado,
    createdAt: fila.created_at,
    updatedAt: fila.updated_at,
  };
}

/** Escapa los comodines del `LIKE` para tratar `q` como texto literal. */
function escaparLike(texto) {
  return texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`);
}

/** Lee la fila de la base y la devuelve ya mapeada (`null` si no existe). */
function obtenerFila(id) {
  return mapearTarea(obtenerConexion().prepare(SQL.obtener).get(id));
}

/* ------------------------------------------------------------------ *
 * Helpers del contrato
 * ------------------------------------------------------------------ */

/**
 * Listado de tareas, mas recientes primero.
 * @param {{ estado?: string, q?: string }} [filtros]
 *        estado -> filtrado exacto por estado; q -> busqueda parcial por titulo.
 * @returns {Array<{ id:number, titulo:string, descripcion:string, prioridad:string,
 *                   estado:string, createdAt:string, updatedAt:string }>}
 */
export function listarTareas({ estado, q } = {}) {
  const db = obtenerConexion();

  const estadoFiltro = validarEnum(estado, ESTADOS, 'estado');

  let qFiltro = null;
  if (q !== undefined && q !== null && q !== '') {
    const texto = normalizarTexto(q, 'q');
    qFiltro = texto === undefined || texto === '' ? null : `%${escaparLike(texto)}%`;
  }

  const filas = db.prepare(SQL.listar).all({ estado: estadoFiltro ?? null, q: qFiltro });
  return filas.map(mapearTarea);
}

/**
 * @param {number|string} id
 * @returns {object|null} la tarea o `null` si no existe.
 */
export function obtenerTarea(id) {
  return obtenerFila(normalizarId(id));
}

/**
 * Alta de una tarea.
 * @param {{ titulo: string, descripcion?: string, prioridad?: string, estado?: string }} datos
 * @returns {object} tarea ya guardada, con `id` numerico.
 */
export function crearTarea({ titulo, descripcion = '', prioridad = 'media', estado = 'pendiente' } = {}) {
  const db = obtenerConexion();
  const tituloLimpio = normalizarTexto(titulo, 'titulo', {
    minimo: TITULO_MINIMO,
    maximo: TITULO_MAXIMO,
    obligatorio: true,
  });
  const descripcionLimpia = normalizarTexto(descripcion, 'descripcion', { maximo: 5000 }) ?? '';
  const prioridadValida = validarEnum(prioridad, PRIORIDADES, 'prioridad') ?? 'media';
  const estadoValido = validarEnum(estado, ESTADOS, 'estado') ?? 'pendiente';

  const resultado = db.prepare(SQL.crear).run(tituloLimpio, descripcionLimpia, prioridadValida, estadoValido);
  return obtenerTarea(Number(resultado.lastInsertRowid));
}

/**
 * OJO: `actualizarTarea(id, datos)` hace actualizacion parcial.
 * `datos` acepta `titulo`, `descripcion`, `prioridad` y `estado`; las claves
 * `id`, `createdAt`/`created_at` y `updatedAt`/`updated_at` se ignoran
 * (son datos de salida), y cualquier otra clave desconocida lanza `TypeError`.
 *
 * @param {number|string} id
 * @param {object} datos
 * @returns {object|null} tarea actualizada con `updated_at` refrescado, o `null`.
 */
export function actualizarTarea(id, datos = {}) {
  if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) {
    throw error('«datos» debe ser un objeto con los campos a modificar');
  }

  const idFila = normalizarId(id);
  const noEditables = new Set(['id', 'createdAt', 'created_at', 'updatedAt', 'updated_at']);
  const campos = {};

  for (const [clave, valor] of Object.entries(datos)) {
    if (noEditables.has(clave)) continue;
    switch (clave) {
      case 'titulo':
        campos.titulo = normalizarTexto(valor, 'titulo', { minimo: TITULO_MINIMO, maximo: TITULO_MAXIMO, obligatorio: true });
        break;
      case 'descripcion':
        campos.descripcion = normalizarTexto(valor, 'descripcion', { maximo: 5000 });
        break;
      case 'prioridad':
        campos.prioridad = validarEnum(valor, PRIORIDADES, 'prioridad');
        break;
      case 'estado':
        campos.estado = validarEnum(valor, ESTADOS, 'estado');
        break;
      default:
        throw error(`campo desconocido en «${clave}». Editables: titulo, descripcion, prioridad, estado`);
    }
  }

  // Nada que cambiar: se devuelve la situacion actual sin escribir.
  if (Object.keys(campos).length === 0) return obtenerFila(idFila);

  const db = obtenerConexion();
  const sentencia = db.prepare(SQL.actualizar);
  const orden = [campos.titulo ?? null, campos.descripcion ?? null, campos.prioridad ?? null, campos.estado ?? null, idFila];
  const resultado = sentencia.run(...orden);

  // `changes` es 0 cuando el id no existe: se traduce como "no encontrada".
  return resultado.changes > 0 ? obtenerFila(idFila) : null;
}

/**
 * Cambio de estado suelto (alta, media y baja no tienen helper propio: se
 * modifican con `actualizarTarea`).
 * @param {number|string} id
 * @param {string} estado
 * @returns {object|null}
 */
export function cambiarEstado(id, estado) {
  const estadoValido = validarEnum(estado, ESTADOS, 'estado');
  if (estadoValido === undefined) throw error('«estado» es obligatorio');
  return actualizarTarea(id, { estado: estadoValido });
}

/**
 * @param {number|string} id
 * @returns {boolean} `true` si existia y se ha borrado; `false` si no existia.
 */
export function eliminarTarea(id) {
  const resultado = obtenerConexion().prepare(SQL.eliminar).run(normalizarId(id));
  return resultado.changes > 0;
}
