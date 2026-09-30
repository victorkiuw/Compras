import * as SQLite from 'expo-sqlite';

type Migracion = string | ((db: SQLite.SQLiteDatabase) => Promise<void>);

// Cada posición es una migración; PRAGMA user_version guarda cuántas se aplicaron.
// Nunca modificar una migración ya publicada: agregar una nueva al final.
const MIGRACIONES: Migracion[] = [
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

  // v2: facturas que agrupan varios productos y precios en dólares con su tasa de cambio.
  async (db) => {
    await db.execAsync(`
      CREATE TABLE factura (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lista_id INTEGER NOT NULL REFERENCES lista_compra(id) ON DELETE CASCADE,
        comercio_id INTEGER REFERENCES comercio(id) ON DELETE SET NULL,
        metodo_pago TEXT,
        tasa_bs REAL,
        foto_uri TEXT,
        total_bs REAL NOT NULL DEFAULT 0,
        total_usd REAL,
        fecha TEXT NOT NULL
      );
      CREATE INDEX idx_factura_lista ON factura(lista_id);

      ALTER TABLE lista_compra ADD COLUMN total_gastado_usd REAL;
      ALTER TABLE item_compra ADD COLUMN factura_id INTEGER REFERENCES factura(id) ON DELETE SET NULL;
      ALTER TABLE item_compra ADD COLUMN precio_pagado_usd REAL;
      ALTER TABLE item_compra ADD COLUMN tasa_bs REAL;
      ALTER TABLE registro_precio_historico ADD COLUMN precio_unitario_usd REAL;
      ALTER TABLE registro_precio_historico ADD COLUMN tasa_bs REAL;
      ALTER TABLE registro_precio_historico ADD COLUMN cantidad REAL;

      UPDATE registro_precio_historico
      SET cantidad = (SELECT cantidad_comprada FROM item_compra i WHERE i.id = registro_precio_historico.item_id)
      WHERE item_id IS NOT NULL;
    `);
    // Cada compra ya registrada pasa a tener su propia factura.
    const comprados = await db.getAllAsync<{
      id: number;
      lista_id: number;
      comercio_id: number | null;
      metodo_pago: string | null;
      foto_factura_uri: string | null;
      precio_pagado_bs: number | null;
      comprado_en: string | null;
    }>('SELECT * FROM item_compra WHERE comprado = 1');
    for (const i of comprados) {
      const r = await db.runAsync(
        'INSERT INTO factura (lista_id, comercio_id, metodo_pago, foto_uri, total_bs, fecha) VALUES (?, ?, ?, ?, ?, ?)',
        i.lista_id,
        i.comercio_id,
        i.metodo_pago,
        i.foto_factura_uri,
        i.precio_pagado_bs ?? 0,
        i.comprado_en ?? new Date().toISOString(),
      );
      await db.runAsync('UPDATE item_compra SET factura_id = ? WHERE id = ?', r.lastInsertRowId, i.id);
    }
  },

  // v3: métodos Efectivo/Crédito (se reconstruye item_compra para quitar el CHECK de
  // metodo_pago), notas y "no había" por producto, créditos con abonos y listas frecuentes.
  `
  CREATE TABLE item_compra_v3 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lista_id INTEGER NOT NULL REFERENCES lista_compra(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES producto(id),
    texto_original TEXT,
    unidad TEXT,
    cantidad_pedida REAL,
    cantidad_comprada REAL,
    precio_pagado_bs REAL,
    comercio_id INTEGER REFERENCES comercio(id) ON DELETE SET NULL,
    metodo_pago TEXT,
    comprado INTEGER NOT NULL DEFAULT 0,
    comprado_en TEXT,
    foto_factura_uri TEXT,
    orden INTEGER NOT NULL DEFAULT 0,
    factura_id INTEGER REFERENCES factura(id) ON DELETE SET NULL,
    precio_pagado_usd REAL,
    tasa_bs REAL,
    nota TEXT,
    no_disponible INTEGER NOT NULL DEFAULT 0
  );
  INSERT INTO item_compra_v3 (id, lista_id, producto_id, texto_original, unidad, cantidad_pedida, cantidad_comprada,
    precio_pagado_bs, comercio_id, metodo_pago, comprado, comprado_en, foto_factura_uri, orden, factura_id,
    precio_pagado_usd, tasa_bs)
  SELECT id, lista_id, producto_id, texto_original, unidad, cantidad_pedida, cantidad_comprada,
    precio_pagado_bs, comercio_id, metodo_pago, comprado, comprado_en, foto_factura_uri, orden, factura_id,
    precio_pagado_usd, tasa_bs
  FROM item_compra;
  DROP TABLE item_compra;
  ALTER TABLE item_compra_v3 RENAME TO item_compra;
  CREATE INDEX idx_item_lista ON item_compra(lista_id);
  CREATE INDEX idx_item_factura ON item_compra(factura_id);

  ALTER TABLE factura ADD COLUMN vence TEXT;
  ALTER TABLE factura ADD COLUMN pagada_en TEXT;

  CREATE TABLE abono (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    factura_id INTEGER NOT NULL REFERENCES factura(id) ON DELETE CASCADE,
    monto_usd REAL NOT NULL,
    fecha TEXT NOT NULL,
    nota TEXT
  );
  CREATE INDEX idx_abono_factura ON abono(factura_id);

  CREATE TABLE plantilla (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    texto TEXT NOT NULL,
    creada TEXT NOT NULL
  );
  `,
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrar(db: SQLite.SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const fila = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = fila?.user_version ?? 0;
  // Las claves foráneas se desactivan durante las migraciones (fuera de la transacción,
  // si no SQLite lo ignora) para poder reconstruir tablas referenciadas.
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    for (let v = version; v < MIGRACIONES.length; v++) {
      await db.withTransactionAsync(async () => {
        const m = MIGRACIONES[v];
        if (typeof m === 'string') await db.execAsync(m);
        else await m(db);
        const rotas = await db.getAllAsync('PRAGMA foreign_key_check');
        if (rotas.length) throw new Error(`Migración ${v + 1}: ${rotas.length} referencias inválidas`);
        await db.execAsync(`PRAGMA user_version = ${v + 1}`);
      });
    }
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
}

/** Copia binaria de toda la base de datos (para respaldos). */
export async function exportarBaseDatos(): Promise<Uint8Array> {
  const db = await getDb();
  return db.serializeAsync();
}

/**
 * Reemplaza todos los datos por los de un respaldo. Valida que sea una base de esta app
 * y la actualiza a la versión actual del esquema.
 */
export async function restaurarBaseDatos(bytes: Uint8Array) {
  const cabecera = String.fromCharCode(...bytes.slice(0, 15));
  if (cabecera !== 'SQLite format 3') throw new Error('El archivo no es un respaldo válido.');
  const origen = await SQLite.deserializeDatabaseAsync(bytes);
  try {
    const tablas = await origen.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'");
    const nombres = new Set(tablas.map((t) => t.name));
    if (!['lista_compra', 'item_compra', 'producto', 'comercio'].every((t) => nombres.has(t))) {
      throw new Error('El archivo no es un respaldo de esta app.');
    }
    const db = await getDb();
    await SQLite.backupDatabaseAsync({ sourceDatabase: origen, destDatabase: db });
    await migrar(db);
  } finally {
    await origen.closeAsync();
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
