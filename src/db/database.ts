import * as SQLite from 'expo-sqlite';

// Cada posición es una migración; PRAGMA user_version guarda cuántas se aplicaron.
const MIGRACIONES: string[] = [
  `
  CREATE TABLE comercio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'Supermercado' CHECK (tipo IN ('Mayorista', 'Supermercado', 'Otro'))
  );

  CREATE TABLE producto (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    nombre_normalizado TEXT NOT NULL UNIQUE,
    categoria TEXT,
    unidad TEXT
  );

  CREATE TABLE lista_compra (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'Activa' CHECK (estado IN ('Activa', 'Cerrada')),
    total_gastado_bs REAL NOT NULL DEFAULT 0,
    cerrada_en TEXT
  );

  CREATE TABLE item_compra (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lista_id INTEGER NOT NULL REFERENCES lista_compra(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES producto(id),
    texto_original TEXT,
    unidad TEXT,
    cantidad_pedida REAL,
    cantidad_comprada REAL,
    precio_pagado_bs REAL,
    comercio_id INTEGER REFERENCES comercio(id) ON DELETE SET NULL,
    metodo_pago TEXT CHECK (metodo_pago IN ('Tarjeta', 'Pago Móvil')),
    comprado INTEGER NOT NULL DEFAULT 0,
    comprado_en TEXT,
    foto_factura_uri TEXT,
    orden INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_item_lista ON item_compra(lista_id);

  CREATE TABLE registro_precio_historico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id INTEGER NOT NULL REFERENCES producto(id) ON DELETE CASCADE,
    comercio_id INTEGER NOT NULL REFERENCES comercio(id),
    item_id INTEGER REFERENCES item_compra(id) ON DELETE SET NULL,
    precio_unitario_bs REAL NOT NULL,
    unidad TEXT,
    fecha TEXT NOT NULL
  );
  CREATE INDEX idx_historico_producto ON registro_precio_historico(producto_id, fecha DESC);

  CREATE TABLE ajuste (
    clave TEXT PRIMARY KEY,
    valor TEXT
  );

  INSERT INTO comercio (nombre, tipo) VALUES ('Makro', 'Mayorista'), ('Hyperlider', 'Supermercado');
  `,
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrar(db: SQLite.SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const fila = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = fila?.user_version ?? 0;
  for (let v = version; v < MIGRACIONES.length; v++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRACIONES[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('compras.db').then(async (db) => {
      await migrar(db);
      return db;
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}
