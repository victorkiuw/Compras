import type { CompraRegistrada } from '../lib/ahorro';
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
  total_gastado_usd: number | null;
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
  precio_pagado_usd: number | null;
  tasa_bs: number | null;
  comercio_id: number | null;
  comercio_nombre: string | null;
  metodo_pago: MetodoPago | null;
  comprado: number;
  comprado_en: string | null;
  foto_factura_uri: string | null;
  factura_id: number | null;
}

export interface Factura {
  id: number;
  lista_id: number;
  comercio_id: number | null;
  comercio_nombre: string | null;
  metodo_pago: MetodoPago | null;
  tasa_bs: number | null;
  foto_uri: string | null;
  total_bs: number;
  total_usd: number | null;
  fecha: string;
}

/** Último precio conocido de un producto en un comercio. */
export interface PrecioComercio {
  producto_id: number;
  comercio_id: number;
  comercio_nombre: string;
  precio_unitario_bs: number;
  precio_unitario_usd: number | null;
  unidad: string | null;
  fecha: string;
  minimo_usd: number | null;
  registros: number;
}

export interface ReferenciaPrecio {
  ultimo: PrecioComercio;
  /** El comercio con el último precio más bajo, si no es el mismo del último registro. */
  masBarato: PrecioComercio | null;
}

export interface LineaFactura {
  itemId: number;
  cantidad: number;
  totalBs: number;
  totalUsd: number | null;
}

export interface DatosFactura {
  comercioId: number;
  metodo: MetodoPago;
  tasaBs: number | null;
  fotoUri: string | null;
  lineas: LineaFactura[];
}

const ahora = () => new Date().toISOString();

/** Precio para comparar: dólares si ambos lo tienen, si no bolívares. */
export function comparar(a: PrecioComercio, b: PrecioComercio): number {
  if (a.precio_unitario_usd != null && b.precio_unitario_usd != null) return a.precio_unitario_usd - b.precio_unitario_usd;
  if (a.precio_unitario_usd != null) return -1;
  if (b.precio_unitario_usd != null) return 1;
  return a.precio_unitario_bs - b.precio_unitario_bs;
}

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

export async function contarPreciosComercio(id: number): Promise<number> {
  const db = await getDb();
  const fila = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM registro_precio_historico WHERE comercio_id = ?',
    id,
  );
  return fila?.n ?? 0;
}

/**
 * Borra el comercio y los precios registrados en él (salen del radar y del cálculo de ahorro).
 * Las compras pasadas se conservan en el historial, sin comercio asignado.
 */
export async function eliminarComercio(id: number) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM registro_precio_historico WHERE comercio_id = ?', id);
    await db.runAsync('DELETE FROM comercio WHERE id = ?', id);
  });
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

export async function getItems(listaId: number): Promise<Item[]> {
  const db = await getDb();
  return db.getAllAsync<Item>(
    `SELECT i.*, p.nombre AS producto_nombre, c.nombre AS comercio_nombre
     FROM item_compra i
     JOIN producto p ON p.id = i.producto_id
     LEFT JOIN comercio c ON c.id = i.comercio_id
     WHERE i.lista_id = ?
     ORDER BY i.orden, i.id`,
    listaId,
  );
}

export async function getFacturas(listaId: number): Promise<Factura[]> {
  const db = await getDb();
  return db.getAllAsync<Factura>(
    `SELECT f.*, c.nombre AS comercio_nombre
     FROM factura f LEFT JOIN comercio c ON c.id = f.comercio_id
     WHERE f.lista_id = ?
     ORDER BY f.fecha DESC, f.id DESC`,
    listaId,
  );
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

const DESMARCAR_ITEM = `
  UPDATE item_compra SET comprado = 0, comprado_en = NULL, cantidad_comprada = NULL, precio_pagado_bs = NULL,
    precio_pagado_usd = NULL, tasa_bs = NULL, comercio_id = NULL, metodo_pago = NULL, foto_factura_uri = NULL,
    factura_id = NULL
  WHERE id = ?`;

const RECALCULAR_FACTURA = `
  UPDATE factura SET
    total_bs = (SELECT COALESCE(SUM(precio_pagado_bs), 0) FROM item_compra WHERE factura_id = factura.id),
    total_usd = (SELECT SUM(precio_pagado_usd) FROM item_compra WHERE factura_id = factura.id)
  WHERE id = ?`;

/**
 * Crea o actualiza una factura con uno o varios productos. Los productos que estaban en
 * la factura y ya no vienen en `lineas` vuelven a quedar pendientes.
 */
export async function guardarFactura(facturaId: number | null, listaId: number, d: DatosFactura): Promise<number> {
  const db = await getDb();
  const fecha = ahora();
  let id = facturaId;
  await db.withTransactionAsync(async () => {
    if (id == null) {
      const r = await db.runAsync(
        'INSERT INTO factura (lista_id, comercio_id, metodo_pago, tasa_bs, foto_uri, fecha) VALUES (?, ?, ?, ?, ?, ?)',
        listaId,
        d.comercioId,
        d.metodo,
        d.tasaBs,
        d.fotoUri,
        fecha,
      );
      id = r.lastInsertRowId;
    } else {
      await db.runAsync(
        'UPDATE factura SET comercio_id = ?, metodo_pago = ?, tasa_bs = ?, foto_uri = ? WHERE id = ?',
        d.comercioId,
        d.metodo,
        d.tasaBs,
        d.fotoUri,
        id,
      );
      const anteriores = await db.getAllAsync<{ id: number }>('SELECT id FROM item_compra WHERE factura_id = ?', id);
      for (const a of anteriores) {
        if (d.lineas.some((l) => l.itemId === a.id)) continue;
        await db.runAsync('DELETE FROM registro_precio_historico WHERE item_id = ?', a.id);
        await db.runAsync(DESMARCAR_ITEM, a.id);
      }
    }

    for (const l of d.lineas) {
      const item = await db.getFirstAsync<{ producto_id: number; unidad: string | null; comprado_en: string | null }>(
        'SELECT producto_id, unidad, comprado_en FROM item_compra WHERE id = ?',
        l.itemId,
      );
      if (!item) continue;
      await db.runAsync(
        `UPDATE item_compra SET comprado = 1, comprado_en = ?, cantidad_comprada = ?, precio_pagado_bs = ?,
           precio_pagado_usd = ?, tasa_bs = ?, comercio_id = ?, metodo_pago = ?, foto_factura_uri = ?, factura_id = ?
         WHERE id = ?`,
        item.comprado_en ?? fecha,
        l.cantidad,
        l.totalBs,
        l.totalUsd,
        d.tasaBs,
        d.comercioId,
        d.metodo,
        d.fotoUri,
        id,
        l.itemId,
      );
      // Un registro histórico por ítem: si se edita la compra, se reemplaza.
      await db.runAsync('DELETE FROM registro_precio_historico WHERE item_id = ?', l.itemId);
      if (l.cantidad > 0 && l.totalBs > 0) {
        await db.runAsync(
          `INSERT INTO registro_precio_historico
             (producto_id, comercio_id, item_id, precio_unitario_bs, precio_unitario_usd, tasa_bs, cantidad, unidad, fecha)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          item.producto_id,
          d.comercioId,
          l.itemId,
          l.totalBs / l.cantidad,
          l.totalUsd != null ? l.totalUsd / l.cantidad : null,
          d.tasaBs,
          l.cantidad,
          item.unidad,
          item.comprado_en ?? fecha,
        );
      }
    }

    await db.runAsync(RECALCULAR_FACTURA, id);
    await db.runAsync(
      `INSERT INTO ajuste (clave, valor) VALUES ('ultimo_comercio', ?), ('ultimo_metodo', ?)
       ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
      String(d.comercioId),
      d.metodo,
    );
  });
  return id!;
}

/** Vuelve a dejar pendiente un producto; si su factura queda vacía, se borra. */
export async function deshacerCompra(itemId: number) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const fila = await db.getFirstAsync<{ factura_id: number | null }>('SELECT factura_id FROM item_compra WHERE id = ?', itemId);
    await db.runAsync('DELETE FROM registro_precio_historico WHERE item_id = ?', itemId);
    await db.runAsync(DESMARCAR_ITEM, itemId);
    if (fila?.factura_id) await limpiarFactura(fila.factura_id);
  });
}

export async function eliminarFactura(facturaId: number) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const items = await db.getAllAsync<{ id: number }>('SELECT id FROM item_compra WHERE factura_id = ?', facturaId);
    for (const i of items) {
      await db.runAsync('DELETE FROM registro_precio_historico WHERE item_id = ?', i.id);
      await db.runAsync(DESMARCAR_ITEM, i.id);
    }
    await db.runAsync('DELETE FROM factura WHERE id = ?', facturaId);
  });
}

async function limpiarFactura(facturaId: number) {
  const db = await getDb();
  const quedan = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM item_compra WHERE factura_id = ?', facturaId);
  if (!quedan?.n) await db.runAsync('DELETE FROM factura WHERE id = ?', facturaId);
  else await db.runAsync(RECALCULAR_FACTURA, facturaId);
}

export async function eliminarItems(itemIds: number[]) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const itemId of itemIds) {
      const fila = await db.getFirstAsync<{ factura_id: number | null }>('SELECT factura_id FROM item_compra WHERE id = ?', itemId);
      await db.runAsync('DELETE FROM registro_precio_historico WHERE item_id = ?', itemId);
      await db.runAsync('DELETE FROM item_compra WHERE id = ?', itemId);
      if (fila?.factura_id) await limpiarFactura(fila.factura_id);
    }
  });
}

/** Cierra la lista. Si moverPendientes, los ítems no comprados pasan a una lista nueva. */
export async function cerrarLista(listaId: number, moverPendientes: boolean): Promise<number | null> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE lista_compra SET estado = 'Cerrada', cerrada_en = ?,
       total_gastado_bs = (SELECT COALESCE(SUM(precio_pagado_bs), 0) FROM item_compra WHERE lista_id = ? AND comprado = 1),
       total_gastado_usd = (SELECT SUM(precio_pagado_usd) FROM item_compra WHERE lista_id = ? AND comprado = 1)
     WHERE id = ?`,
    ahora(),
    listaId,
    listaId,
    listaId,
  );
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
  facturas: number;
}

export async function listarListasCerradas(): Promise<ResumenLista[]> {
  const db = await getDb();
  return db.getAllAsync<ResumenLista>(
    `SELECT l.*,
       (SELECT COUNT(*) FROM item_compra i WHERE i.lista_id = l.id) AS items,
       (SELECT COUNT(*) FROM item_compra i WHERE i.lista_id = l.id AND i.comprado = 1) AS comprados,
       (SELECT COUNT(*) FROM factura f WHERE f.lista_id = l.id) AS facturas
     FROM lista_compra l
     WHERE l.estado = 'Cerrada'
     ORDER BY l.fecha DESC, l.id DESC`,
  );
}

// ───────────── Comparador de precios ─────────────

async function preciosPorComercio(filtro: string, ...params: (string | number)[]): Promise<PrecioComercio[]> {
  const db = await getDb();
  const filas = await db.getAllAsync<PrecioComercio>(
    `WITH h AS (
       SELECT r.*,
         ROW_NUMBER() OVER (PARTITION BY r.producto_id, r.comercio_id ORDER BY r.fecha DESC, r.id DESC) AS rn,
         MIN(r.precio_unitario_usd) OVER (PARTITION BY r.producto_id, r.comercio_id) AS minimo_usd,
         COUNT(*) OVER (PARTITION BY r.producto_id, r.comercio_id) AS registros
       FROM registro_precio_historico r
       WHERE ${filtro}
     )
     SELECT h.producto_id, h.comercio_id, c.nombre AS comercio_nombre, h.precio_unitario_bs, h.precio_unitario_usd,
       h.unidad, h.fecha, h.minimo_usd, h.registros
     FROM h JOIN comercio c ON c.id = h.comercio_id
     WHERE h.rn = 1`,
    ...params,
  );
  return filas.sort((a, b) => a.producto_id - b.producto_id || comparar(a, b));
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
      masBarato: barato.comercio_id !== ultimo.comercio_id && comparar(barato, ultimo) < 0 ? barato : null,
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

export async function getProducto(id: number) {
  const db = await getDb();
  return db.getFirstAsync<{ id: number; nombre: string; unidad: string | null }>(
    'SELECT id, nombre, unidad FROM producto WHERE id = ?',
    id,
  );
}

export interface RegistroHistorico extends CompraRegistrada {
  id: number;
  precio_unitario_bs: number;
  tasa_bs: number | null;
  unidad: string | null;
}

export async function historialProducto(productoId: number): Promise<RegistroHistorico[]> {
  const db = await getDb();
  return db.getAllAsync<RegistroHistorico>(
    `SELECT r.id, r.comercio_id, c.nombre AS comercio_nombre, r.precio_unitario_bs, r.precio_unitario_usd,
       r.tasa_bs, r.cantidad, r.unidad, r.fecha
     FROM registro_precio_historico r JOIN comercio c ON c.id = r.comercio_id
     WHERE r.producto_id = ?
     ORDER BY r.fecha DESC, r.id DESC`,
    productoId,
  );
}
