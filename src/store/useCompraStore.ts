import { create } from 'zustand';
import * as repo from '../db/repo';
import type { CambiosItem, Comercio, DatosFactura, Factura, Item, Lista, MetodoPago, ReferenciaPrecio } from '../db/repo';
import type { Moneda } from '../lib/format';
import type { ItemParseado } from '../lib/parser';
import { obtenerTasa, type TipoTasa } from '../lib/tasa';

interface CompraState {
  listo: boolean;
  error: string | null;
  lista: Lista | null;
  items: Item[];
  facturas: Factura[];
  referencias: Map<number, ReferenciaPrecio>;
  comercios: Comercio[];
  ultimoComercioId: number | null;
  ultimoMetodo: MetodoPago;
  /** Bolívares por dólar que se usan por defecto en las facturas nuevas. */
  tasaBs: number | null;
  tasaFecha: string | null;
  /** 'auto' = descargada de internet, 'manual' = escrita por el usuario. */
  tasaOrigen: 'auto' | 'manual' | null;
  tasaFuente: string | null;
  tasaTipo: TipoTasa;
  actualizandoTasa: boolean;
  /** true si el último intento automático falló (sin conexión, servicio caído). */
  tasaSinConexion: boolean;
  /** Fecha del último respaldo exportado (para recordar hacer uno cada semana). */
  ultimoRespaldo: string | null;
  /** Moneda en la que se escriben los precios por defecto. */
  moneda: Moneda;

  iniciar: () => Promise<void>;
  recargar: () => Promise<void>;
  recargarComercios: () => Promise<void>;
  /** Tasa escrita a mano (se usa hasta el día siguiente o hasta pedir la automática). */
  setTasa: (tasa: number) => Promise<void>;
  /** Descarga la tasa. Sin `forzar`, solo si la guardada no es de hoy o no es automática del tipo elegido. */
  actualizarTasa: (forzar?: boolean) => Promise<boolean>;
  setTasaTipo: (tipo: TipoTasa) => Promise<void>;
  setMoneda: (moneda: Moneda) => Promise<void>;
  importar: (items: ItemParseado[], modo: 'nueva' | 'agregar') => Promise<void>;
  guardarFactura: (facturaId: number | null, datos: DatosFactura) => Promise<void>;
  eliminarFactura: (facturaId: number) => Promise<void>;
  deshacer: (itemId: number) => Promise<void>;
  eliminarItems: (itemIds: number[]) => Promise<void>;
  editarItem: (itemId: number, cambios: CambiosItem) => Promise<void>;
  marcarNoHabia: (itemIds: number[], valor: boolean) => Promise<void>;
  agregarTexto: (items: ItemParseado[]) => Promise<void>;
  cerrar: (moverPendientes: boolean) => Promise<void>;
}

export const useCompraStore = create<CompraState>((set, get) => ({
  listo: false,
  error: null,
  lista: null,
  items: [],
  facturas: [],
  referencias: new Map(),
  comercios: [],
  ultimoComercioId: null,
  ultimoMetodo: 'Tarjeta',
  tasaBs: null,
  tasaFecha: null,
  tasaOrigen: null,
  tasaFuente: null,
  tasaTipo: 'oficial',
  actualizandoTasa: false,
  tasaSinConexion: false,
  ultimoRespaldo: null,
  moneda: 'USD',

  iniciar: async () => {
    try {
      await Promise.all([get().recargar(), get().recargarComercios()]);
      set({ listo: true, error: null });
      get().actualizarTasa();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  recargar: async () => {
    const lista = await repo.getListaActiva();
    const [items, facturas, referencias, ultimoComercio, ultimoMetodo, tasa, tasaFecha, moneda, origen, fuente, tipo, ultimoRespaldo] = await Promise.all([
      lista ? repo.getItems(lista.id) : Promise.resolve([]),
      lista ? repo.getFacturas(lista.id) : Promise.resolve([]),
      lista ? repo.referenciasDeLista(lista.id) : Promise.resolve(new Map<number, ReferenciaPrecio>()),
      repo.getAjuste('ultimo_comercio'),
      repo.getAjuste('ultimo_metodo'),
      repo.getAjuste('tasa_bs'),
      repo.getAjuste('tasa_fecha'),
      repo.getAjuste('moneda'),
      repo.getAjuste('tasa_origen'),
      repo.getAjuste('tasa_fuente'),
      repo.getAjuste('tasa_tipo'),
      repo.getAjuste('ultimo_respaldo'),
    ]);
    set({
      lista,
      items,
      facturas,
      referencias,
      ultimoComercioId: ultimoComercio ? Number(ultimoComercio) : null,
      // El crédito no se propone por defecto: se elige a propósito en cada factura.
      ultimoMetodo: ultimoMetodo === 'Pago Móvil' || ultimoMetodo === 'Efectivo' ? ultimoMetodo : 'Tarjeta',
      tasaBs: tasa ? Number(tasa) : null,
      tasaFecha,
      moneda: moneda === 'BS' ? 'BS' : 'USD',
      tasaOrigen: origen === 'auto' || origen === 'manual' ? origen : null,
      tasaFuente: fuente,
      tasaTipo: tipo === 'paralelo' ? 'paralelo' : 'oficial',
      ultimoRespaldo,
    });
  },

  recargarComercios: async () => {
    set({ comercios: await repo.listarComercios() });
  },

  setTasa: async (tasa) => {
    const fecha = new Date().toISOString();
    await guardarTasa(tasa, fecha, 'manual', null);
    set({ tasaBs: tasa, tasaFecha: fecha, tasaOrigen: 'manual', tasaFuente: null });
  },

  actualizarTasa: async (forzar = false) => {
    const { tasaFecha, tasaOrigen, tasaFuente, tasaTipo, actualizandoTasa } = get();
    if (actualizandoTasa) return false;
    const deHoy = !!tasaFecha && esHoy(tasaFecha);
    // La tasa escrita a mano hoy se respeta; la automática se renueva una vez al día.
    if (!forzar && deHoy && (tasaOrigen === 'manual' || tasaFuente?.endsWith(`(${tasaTipo})`))) return true;
    // Sin conexión no se reintenta en cada cambio de pantalla, solo cada 2 minutos.
    if (!forzar && Date.now() - ultimoFallo < 120_000) return false;
    set({ actualizandoTasa: true });
    try {
      const r = await obtenerTasa(tasaTipo);
      if (!r) {
        ultimoFallo = Date.now();
        set({ tasaSinConexion: true });
        return false;
      }
      const fecha = new Date().toISOString();
      const fuente = `${r.fuente} (${tasaTipo})`;
      await guardarTasa(r.tasa, fecha, 'auto', fuente);
      set({ tasaBs: r.tasa, tasaFecha: fecha, tasaOrigen: 'auto', tasaFuente: fuente, tasaSinConexion: false });
      return true;
    } finally {
      set({ actualizandoTasa: false });
    }
  },

  setTasaTipo: async (tipo) => {
    await repo.setAjuste('tasa_tipo', tipo);
    set({ tasaTipo: tipo });
    await get().actualizarTasa(true);
  },

  setMoneda: async (moneda) => {
    set({ moneda });
    await repo.setAjuste('moneda', moneda);
  },

  importar: async (items, modo) => {
    await repo.importarItems(items, modo);
    await get().recargar();
  },

  guardarFactura: async (facturaId, datos) => {
    const lista = get().lista;
    if (!lista) return;
    await repo.guardarFactura(facturaId, lista.id, datos);
    await get().recargar();
  },

  eliminarFactura: async (facturaId) => {
    await repo.eliminarFactura(facturaId);
    await get().recargar();
  },

  deshacer: async (itemId) => {
    await repo.deshacerCompra(itemId);
    await get().recargar();
  },

  editarItem: async (itemId, cambios) => {
    await repo.actualizarItem(itemId, cambios);
    await get().recargar();
  },

  marcarNoHabia: async (itemIds, valor) => {
    await repo.marcarNoDisponible(itemIds, valor);
    await get().recargar();
  },

  agregarTexto: async (items) => {
    const lista = get().lista;
    if (lista) await repo.agregarItems(lista.id, items);
    else await repo.importarItems(items, 'nueva');
    await get().recargar();
  },

  eliminarItems: async (itemIds) => {
    await repo.eliminarItems(itemIds);
    await get().recargar();
  },

  cerrar: async (moverPendientes) => {
    const lista = get().lista;
    if (!lista) return;
    await repo.cerrarLista(lista.id, moverPendientes);
    await get().recargar();
  },
}));

let ultimoFallo = 0;

const esHoy = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

async function guardarTasa(tasa: number, fecha: string, origen: 'auto' | 'manual', fuente: string | null) {
  await repo.setAjuste('tasa_bs', String(tasa));
  await repo.setAjuste('tasa_fecha', fecha);
  await repo.setAjuste('tasa_origen', origen);
  await repo.setAjuste('tasa_fuente', fuente);
}

/** Totales de lo comprado: pagado en el momento (Bs y $) y lo que quedó a crédito ($). */
export function totalGastado(items: Item[]): { bs: number; usd: number; creditoUsd: number } {
  let bs = 0;
  let usd = 0;
  let creditoUsd = 0;
  for (const i of items) {
    if (!i.comprado) continue;
    if (i.metodo_pago === 'Crédito') {
      creditoUsd += i.precio_pagado_usd ?? 0;
      continue;
    }
    bs += i.precio_pagado_bs ?? 0;
    usd += i.precio_pagado_usd ?? 0;
  }
  return { bs, usd, creditoUsd };
}
