import { create } from 'zustand';
import * as repo from '../db/repo';
import type { Comercio, Item, Lista, MetodoPago, ReferenciaPrecio, RegistroCompra } from '../db/repo';
import type { ItemParseado } from '../lib/parser';

interface CompraState {
  listo: boolean;
  error: string | null;
  lista: Lista | null;
  items: Item[];
  referencias: Map<number, ReferenciaPrecio>;
  comercios: Comercio[];
  ultimoComercioId: number | null;
  ultimoMetodo: MetodoPago;

  iniciar: () => Promise<void>;
  recargar: () => Promise<void>;
  recargarComercios: () => Promise<void>;
  importar: (items: ItemParseado[], modo: 'nueva' | 'agregar') => Promise<void>;
  registrar: (itemId: number, datos: RegistroCompra) => Promise<void>;
  deshacer: (itemId: number) => Promise<void>;
  eliminarItem: (itemId: number) => Promise<void>;
  cerrar: (moverPendientes: boolean) => Promise<void>;
}

export const useCompraStore = create<CompraState>((set, get) => ({
  listo: false,
  error: null,
  lista: null,
  items: [],
  referencias: new Map(),
  comercios: [],
  ultimoComercioId: null,
  ultimoMetodo: 'Tarjeta',

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
    const [items, referencias, ultimoComercio, ultimoMetodo] = await Promise.all([
      lista ? repo.getItems(lista.id) : Promise.resolve([]),
      lista ? repo.referenciasDeLista(lista.id) : Promise.resolve(new Map<number, ReferenciaPrecio>()),
      repo.getAjuste('ultimo_comercio'),
      repo.getAjuste('ultimo_metodo'),
    ]);
    set({
      lista,
      items,
      referencias,
      ultimoComercioId: ultimoComercio ? Number(ultimoComercio) : null,
      ultimoMetodo: ultimoMetodo === 'Pago Móvil' ? 'Pago Móvil' : 'Tarjeta',
    });
  },

  recargarComercios: async () => {
    set({ comercios: await repo.listarComercios() });
  },

  importar: async (items, modo) => {
    await repo.importarItems(items, modo);
    await get().recargar();
  },

  registrar: async (itemId, datos) => {
    await repo.registrarCompra(itemId, datos);
    await get().recargar();
  },

  deshacer: async (itemId) => {
    await repo.deshacerCompra(itemId);
    await get().recargar();
  },

  eliminarItem: async (itemId) => {
    await repo.eliminarItem(itemId);
    await get().recargar();
  },

  cerrar: async (moverPendientes) => {
    const lista = get().lista;
    if (!lista) return;
    await repo.cerrarLista(lista.id, moverPendientes);
    await get().recargar();
  },
}));

export function totalGastado(items: Item[]): number {
  return items.reduce((s, i) => s + (i.comprado ? (i.precio_pagado_bs ?? 0) : 0), 0);
}
