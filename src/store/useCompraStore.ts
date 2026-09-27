import { create } from 'zustand';
import * as repo from '../db/repo';
import type { Comercio, DatosFactura, Factura, Item, Lista, MetodoPago, ReferenciaPrecio } from '../db/repo';
import type { Moneda } from '../lib/format';
import type { ItemParseado } from '../lib/parser';

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
  /** Moneda en la que se escriben los precios por defecto. */
  moneda: Moneda;

  iniciar: () => Promise<void>;
  recargar: () => Promise<void>;
  recargarComercios: () => Promise<void>;
  setTasa: (tasa: number) => Promise<void>;
  setMoneda: (moneda: Moneda) => Promise<void>;
  importar: (items: ItemParseado[], modo: 'nueva' | 'agregar') => Promise<void>;
  guardarFactura: (facturaId: number | null, datos: DatosFactura) => Promise<void>;
  eliminarFactura: (facturaId: number) => Promise<void>;
  deshacer: (itemId: number) => Promise<void>;
  eliminarItems: (itemIds: number[]) => Promise<void>;
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
  moneda: 'USD',

  iniciar: async () => {
    try {
      await Promise.all([get().recargar(), get().recargarComercios()]);
      set({ listo: true, error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  recargar: async () => {
    const lista = await repo.getListaActiva();
    const [items, facturas, referencias, ultimoComercio, ultimoMetodo, tasa, tasaFecha, moneda] = await Promise.all([
      lista ? repo.getItems(lista.id) : Promise.resolve([]),
      lista ? repo.getFacturas(lista.id) : Promise.resolve([]),
      lista ? repo.referenciasDeLista(lista.id) : Promise.resolve(new Map<number, ReferenciaPrecio>()),
      repo.getAjuste('ultimo_comercio'),
      repo.getAjuste('ultimo_metodo'),
      repo.getAjuste('tasa_bs'),
      repo.getAjuste('tasa_fecha'),
      repo.getAjuste('moneda'),
    ]);
    set({
      lista,
      items,
      facturas,
      referencias,
      ultimoComercioId: ultimoComercio ? Number(ultimoComercio) : null,
      ultimoMetodo: ultimoMetodo === 'Pago Móvil' ? 'Pago Móvil' : 'Tarjeta',
      tasaBs: tasa ? Number(tasa) : null,
      tasaFecha,
      moneda: moneda === 'BS' ? 'BS' : 'USD',
    });
  },

  recargarComercios: async () => {
    set({ comercios: await repo.listarComercios() });
  },

  setTasa: async (tasa) => {
    const fecha = new Date().toISOString();
    await repo.setAjuste('tasa_bs', String(tasa));
    await repo.setAjuste('tasa_fecha', fecha);
    set({ tasaBs: tasa, tasaFecha: fecha });
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

export function totalGastado(items: Item[]): { bs: number; usd: number } {
  let bs = 0;
  let usd = 0;
  for (const i of items) {
    if (!i.comprado) continue;
    bs += i.precio_pagado_bs ?? 0;
    usd += i.precio_pagado_usd ?? 0;
  }
  return { bs, usd };
}
