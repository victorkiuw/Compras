import { normalizarNombre, type ItemParseado } from '../lib/parser';
import { getDb } from './database';

export type TipoComercio = 'Mayorista' | 'Supermercado' | 'Otro';
export type MetodoPago = 'Tarjeta' | 'Pago Móvil';

export interface Comercio {
  id: number;
  nombre: string;
  tipo: TipoComercio;
}

export interface Lista {
  id: number;
  fecha: string;
  estado: 'Activa' | 'Cerrada';
  total_gastado_bs: number;
  cerrada_en: string | null;
}

export interface Item {
  id: number;
  lista_id: number;
  producto_id: number;
  producto_nombre: string;
  texto_original: string | null;
  unidad: string | null;
  cantidad_pedida: number | null;
  cantidad_comprada: number | null;
  precio_pagado_bs: number | null;
  comercio_id: number | null;
  comercio_nombre: string | null;
  metodo_pago: MetodoPago | null;
  comprado: number;
  comprado_en: string | null;
  foto_factura_uri: string | null;
}

/** Último precio conocido de un producto en un comercio. */
export interface PrecioComercio {
  producto_id: number;
  comercio_id: number;
  comercio_nombre: string;
  precio_unitario_bs: number;
  unidad: string | null;
  fecha: string;
  minimo_bs: number;
  registros: number;
}

export interface ReferenciaPrecio {
  ultimo: PrecioComercio;
  /** El comercio con el último precio más bajo, si no es el mismo del último registro. */
  masBarato: PrecioComercio | null;
}

export interface RegistroCompra {
  cantidad: number;
  totalBs: number;
  comercioId: number;
  metodo: MetodoPago;
  fotoUri: string | null;
}

const ahora = () => new Date().toISOString();

// ───────────── Ajustes ─────────────

export async function getAjuste(clave: string): Promise<string | null> {
  const db = await getDb();
  const fila = await db.getFirstAsync<{ valor: string | null }>('SELECT valor FROM ajuste WHERE clave = ?', clave);
  return fila?.valor ?? null;
}

export async function setAjuste(clave: string, valor: string | null) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO ajuste (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor',
    clave,
    valor,
  );
}

// ───────────── Comercios ─────────────

export async function listarComercios(): Promise<Comercio[]> {
  const db = await getDb();
  return db.getAllAsync<Comercio>('SELECT * FROM comercio ORDER BY nombre COLLATE NOCASE');
}

export async function crearComercio(nombre: string, tipo: TipoComercio): Promise<number> {
  const db = await getDb();
  const r = await db.runAsync('INSERT INTO comercio (nombre, tipo) VALUES (?, ?)', nombre.trim(), tipo);
  return r.lastInsertRowId;
}

export async function actualizarComercio(id: number, nombre: string, tipo: TipoComercio) {
  const db = await getDb();
  await db.runAsync('UPDATE comercio SET nombre = ?, tipo = ? WHERE id = ?', nombre.trim(), tipo, id);
}

/** Devuelve false si el comercio tiene precios registrados (para no perder el historial). */
export async function eliminarComercio(id: number): Promise<boolean> {
  const db = await getDb();
  const uso = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM registro_precio_historico WHERE comercio_id = ?',
    id,
  );
  if (uso && uso.n > 0) return false;
  await db.runAsync('DELETE FROM comercio WHERE id = ?', id);
  return true;
}

// ───────────── Listas e ítems ─────────────

export async function getListaActiva(): Promise<Lista | null> {
  const db = await getDb();
  return db.getFirstAsync<Lista>("SELECT * FROM lista_compra WHERE estado = 'Activa' ORDER BY id DESC LIMIT 1");
}

export async function getLista(id: number): Promise<Lista | null> {
  const db = await getDb();
  return db.getFirstAsync<Lista>('SELECT * FROM lista_compra WHERE id = ?', id);
}

const SELECT_ITEMS = `
  SELECT i.*, p.nombre AS producto_nombre, c.nombre AS comercio_nombre
  FROM item_compra i
  JOIN producto p ON p.id = i.producto_id
  LEFT JOIN comercio c ON c.id = i.comercio_id
  WHERE i.lista_id = ?
  ORDER BY i.orden, i.id`;

export async function getItems(listaId: number): Promise<Item[]> {
  const db = await getDb();
  return db.getAllAsync<Item>(SELECT_ITEMS, listaId);
}

async function obtenerOCrearProducto(nombre: string, unidad: string | null): Promise<number> {
  const db = await getDb();
  const clave = normalizarNombre(nombre);
  const existente = await db.getFirstAsync<{ id: number; unidad: string | null }>(
    'SELECT id, unidad FROM producto WHERE nombre_normalizado = ?',
    clave,
  );
  if (existente) {
    if (!existente.unidad && unidad) {
      await db.runAsync('UPDATE producto SET unidad = ? WHERE id = ?', unidad, existente.id);
    }
    return existente.id;
  }
  const r = await db.runAsync(
    'INSERT INTO producto (nombre, nombre_normalizado, unidad) VALUES (?, ?, ?)',
    nombre,
    clave,
    unidad,
  );
  return r.lastInsertRowId;
}

async function cerrarListaInterno(listaId: number) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE lista_compra SET estado = 'Cerrada', cerrada_en = ?,
       total_gastado_bs = (SELECT COALESCE(SUM(precio_pagado_bs), 0) FROM item_compra WHERE lista_id = ? AND comprado = 1)
     WHERE id = ?`,
    ahora(),
    listaId,
    listaId,
  );
}

export async function crearLista(): Promise<number> {
  const db = await getDb();
  const r = await db.runAsync("INSERT INTO lista_compra (fecha, estado) VALUES (?, 'Activa')", ahora());
  return r.lastInsertRowId;
}

export async function agregarItems(listaId: number, items: ItemParseado[]) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const fila = await db.getFirstAsync<{ m: number | null }>(
      'SELECT MAX(orden) AS m FROM item_compra WHERE lista_id = ?',
      listaId,
    );
    let orden = (fila?.m ?? 0) + 1;
    for (const it of items) {
      const productoId = await obtenerOCrearProducto(it.nombre, it.unidad);
      await db.runAsync(
        `INSERT INTO item_compra (lista_id, producto_id, texto_original, unidad, cantidad_pedida, orden)
         VALUES (?, ?, ?, ?, ?, ?)`,
        listaId,
        productoId,
        it.original,
        it.unidad,
        it.cantidad,
        orden++,
      );
    }
  });
}

/**
 * Importa ítems. Con modo 'nueva' se cierra la lista activa (si existe) y se abre
 * una nueva con fecha de hoy; con 'agregar' se suman a la lista activa.
 */
export async function importarItems(items: ItemParseado[], modo: 'nueva' | 'agregar'): Promise<number> {
  const activa = await getListaActiva();
  let listaId: number;
  if (activa && modo === 'agregar') {
    listaId = activa.id;
  } else {
    if (activa) await cerrarLista(activa.id, false);
    listaId = await crearLista();
  }
  await agregarItems(listaId, items);
  return listaId;
}

export async function registrarCompra(itemId: number, r: RegistroCompra) {
  const db = await getDb();
  const item = await db.getFirstAsync<{ producto_id: number; unidad: string | null }>(
    'SELECT producto_id, unidad FROM item_compra WHERE id = ?',
    itemId,
  );
  if (!item) return;
  const fecha = ahora();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE item_compra SET comprado = 1, comprado_en = ?, cantidad_comprada = ?, precio_pagado_bs = ?,
         comercio_id = ?, metodo_pago = ?, foto_factura_uri = ?
       WHERE id = ?`,
      fecha,
      r.cantidad,
      r.totalBs,
      r.comercioId,
      r.metodo,
      r.fotoUri,
      itemId,
    );
    // Un registro histórico por ítem: si se edita la compra, se reemplaza.
    await db.runAsync('DELETE FROM registro_precio_historico WHERE item_id = ?', itemId);
    if (r.cantidad > 0 && r.totalBs > 0) {
      await db.runAsync(
        `INSERT INTO registro_precio_historico (producto_id, comercio_id, item_id, precio_unitario_bs, unidad, fecha)
         VALUES (?, ?, ?, ?, ?, ?)`,
        item.producto_id,
        r.comercioId,
        itemId,
        r.totalBs / r.cantidad,
        item.unidad,
        fecha,
      );
    }
    await db.runAsync(
      `INSERT INTO ajuste (clave, valor) VALUES ('ultimo_comercio', ?), ('ultimo_metodo', ?)
       ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
      String(r.comercioId),
      r.metodo,
    );
  });
}

export async function deshacerCompra(itemId: number) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE item_compra SET comprado = 0, comprado_en = NULL, cantidad_comprada = NULL, precio_pagado_bs = NULL,
         comercio_id = NULL, metodo_pago = NULL, foto_factura_uri = NULL
       WHERE id = ?`,
      itemId,
    );
    await db.runAsync('DELETE FROM registro_precio_historico WHERE item_id = ?', itemId);
  });
}

export async function eliminarItem(itemId: number) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM registro_precio_historico WHERE item_id = ?', itemId);
    await db.runAsync('DELETE FROM item_compra WHERE id = ?', itemId);
  });
}

export async function actualizarCantidadPedida(itemId: number, cantidad: number | null, unidad: string | null) {
  const db = await getDb();
  await db.runAsync('UPDATE item_compra SET cantidad_pedida = ?, unidad = ? WHERE id = ?', cantidad, unidad, itemId);
}

/** Cierra la lista. Si moverPendientes, los ítems no comprados pasan a una lista nueva. */
export async function cerrarLista(listaId: number, moverPendientes: boolean): Promise<number | null> {
  const db = await getDb();
  await cerrarListaInterno(listaId);
  if (!moverPendientes) return null;
  const pendientes = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM item_compra WHERE lista_id = ? AND comprado = 0',
    listaId,
  );
  if (!pendientes?.n) return null;
  const nueva = await crearLista();
  await db.runAsync('UPDATE item_compra SET lista_id = ? WHERE lista_id = ? AND comprado = 0', nueva, listaId);
  return nueva;
}

export async function eliminarLista(listaId: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM lista_compra WHERE id = ?', listaId);
}

// ───────────── Historial ─────────────

export interface ResumenLista extends Lista {
  items: number;
  comprados: number;
  fotos: number;
}

export async function listarListasCerradas(): Promise<ResumenLista[]> {
  const db = await getDb();
  return db.getAllAsync<ResumenLista>(
    `SELECT l.*,
       (SELECT COUNT(*) FROM item_compra i WHERE i.lista_id = l.id) AS items,
       (SELECT COUNT(*) FROM item_compra i WHERE i.lista_id = l.id AND i.comprado = 1) AS comprados,
       (SELECT COUNT(DISTINCT foto_factura_uri) FROM item_compra i WHERE i.lista_id = l.id AND i.foto_factura_uri IS NOT NULL) AS fotos
     FROM lista_compra l
     WHERE l.estado = 'Cerrada'
     ORDER BY l.fecha DESC, l.id DESC`,
  );
}

// ───────────── Comparador de precios ─────────────

async function preciosPorComercio(filtro: string, ...params: (string | number)[]): Promise<PrecioComercio[]> {
  const db = await getDb();
  return db.getAllAsync<PrecioComercio>(
    `WITH h AS (
       SELECT r.*,
         ROW_NUMBER() OVER (PARTITION BY r.producto_id, r.comercio_id ORDER BY r.fecha DESC, r.id DESC) AS rn,
         MIN(r.precio_unitario_bs) OVER (PARTITION BY r.producto_id, r.comercio_id) AS minimo_bs,
         COUNT(*) OVER (PARTITION BY r.producto_id, r.comercio_id) AS registros
       FROM registro_precio_historico r
       WHERE ${filtro}
     )
     SELECT h.producto_id, h.comercio_id, c.nombre AS comercio_nombre, h.precio_unitario_bs, h.unidad, h.fecha,
       h.minimo_bs, h.registros
     FROM h JOIN comercio c ON c.id = h.comercio_id
     WHERE h.rn = 1
     ORDER BY h.producto_id, h.precio_unitario_bs`,
    ...params,
  );
}

/** Referencia de precio para cada producto de la lista (clave: producto_id). */
export async function referenciasDeLista(listaId: number): Promise<Map<number, ReferenciaPrecio>> {
  // Se excluyen las compras de esta misma lista para comparar contra viajes anteriores.
  const filas = await preciosPorComercio(
    `r.producto_id IN (SELECT producto_id FROM item_compra WHERE lista_id = ?)
     AND (r.item_id IS NULL OR r.item_id NOT IN (SELECT id FROM item_compra WHERE lista_id = ?))`,
    listaId,
    listaId,
  );
  const porProducto = new Map<number, PrecioComercio[]>();
  for (const f of filas) {
    const arr = porProducto.get(f.producto_id) ?? [];
    arr.push(f);
    porProducto.set(f.producto_id, arr);
  }
  const refs = new Map<number, ReferenciaPrecio>();
  for (const [productoId, precios] of porProducto) {
    const ultimo = precios.reduce((a, b) => (b.fecha > a.fecha ? b : a));
    const barato = precios[0]; // ya vienen ordenados por precio
    refs.set(productoId, {
      ultimo,
      masBarato: barato.comercio_id !== ultimo.comercio_id && barato.precio_unitario_bs < ultimo.precio_unitario_bs ? barato : null,
    });
  }
  return refs;
}

export interface ProductoRadar {
  id: number;
  nombre: string;
  unidad: string | null;
  precios: PrecioComercio[];
}

export async function buscarPrecios(texto: string): Promise<ProductoRadar[]> {
  const db = await getDb();
  const clave = `%${normalizarNombre(texto)}%`;
  const productos = await db.getAllAsync<{ id: number; nombre: string; unidad: string | null }>(
    `SELECT p.id, p.nombre, p.unidad FROM producto p
     WHERE p.nombre_normalizado LIKE ?
       AND EXISTS (SELECT 1 FROM registro_precio_historico r WHERE r.producto_id = p.id)
     ORDER BY (SELECT MAX(fecha) FROM registro_precio_historico r WHERE r.producto_id = p.id) DESC
     LIMIT 50`,
    clave,
  );
  if (!productos.length) return [];
  const ids = productos.map((p) => p.id);
  const precios = await preciosPorComercio(`r.producto_id IN (${ids.map(() => '?').join(',')})`, ...ids);
  return productos.map((p) => ({ ...p, precios: precios.filter((x) => x.producto_id === p.id) }));
}

export interface RegistroHistorico {
  id: number;
  comercio_nombre: string;
  precio_unitario_bs: number;
  unidad: string | null;
  fecha: string;
}

export async function historialProducto(productoId: number, limite = 15): Promise<RegistroHistorico[]> {
  const db = await getDb();
  return db.getAllAsync<RegistroHistorico>(
    `SELECT r.id, c.nombre AS comercio_nombre, r.precio_unitario_bs, r.unidad, r.fecha
     FROM registro_precio_historico r JOIN comercio c ON c.id = r.comercio_id
     WHERE r.producto_id = ?
     ORDER BY r.fecha DESC, r.id DESC
     LIMIT ?`,
    productoId,
    limite,
  );
}
