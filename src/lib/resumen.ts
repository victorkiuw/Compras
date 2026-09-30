// Texto de resumen de una compra para enviar por WhatsApp. Sin imports de React Native.
import { formatBs, formatCantidad, formatFecha, formatTasa, formatUsd } from './format.ts';

export interface ItemResumen {
  producto_nombre: string;
  cantidad_pedida: number | null;
  cantidad_comprada: number | null;
  unidad: string | null;
  precio_pagado_bs: number | null;
  precio_pagado_usd: number | null;
  comprado: number;
  no_disponible: number;
  factura_id: number | null;
  nota: string | null;
}

export interface FacturaResumen {
  id: number;
  comercio_nombre: string | null;
  metodo_pago: string | null;
  tasa_bs: number | null;
  total_bs: number;
  total_usd: number | null;
  vence: string | null;
}

const cant = (n: number | null, unidad: string | null) => (n != null ? `${formatCantidad(n)}${unidad ? ` ${unidad}` : ''}` : unidad ?? '');
const dinero = (usd: number | null, bs: number | null) =>
  [usd != null ? formatUsd(usd) : null, bs != null ? formatBs(bs) : null].filter(Boolean).join(' / ');

export function textoResumen(fecha: string, items: ItemResumen[], facturas: FacturaResumen[]): string {
  const comprados = items.filter((i) => i.comprado);
  const noHabia = items.filter((i) => !i.comprado && i.no_disponible);
  const pendientes = items.filter((i) => !i.comprado && !i.no_disponible);

  let pagadoBs = 0;
  let pagadoUsd = 0;
  let creditoUsd = 0;
  for (const f of facturas) {
    if (f.metodo_pago === 'Crédito') creditoUsd += f.total_usd ?? 0;
    else {
      pagadoBs += f.total_bs;
      pagadoUsd += f.total_usd ?? 0;
    }
  }
  const creditoComercios = [...new Set(facturas.filter((f) => f.metodo_pago === 'Crédito').map((f) => f.comercio_nombre ?? '¿?'))];

  const lineas: string[] = [`*Compra del ${formatFecha(fecha)}*`, `✅ Comprado: ${comprados.length} de ${items.length} productos`];
  if (pagadoBs > 0) lineas.push(`💵 Pagado: ${formatBs(pagadoBs)}${pagadoUsd > 0 ? ` (${formatUsd(pagadoUsd)})` : ''}`);
  if (creditoUsd > 0) lineas.push(`🧾 A crédito: ${formatUsd(creditoUsd)} (${creditoComercios.join(', ')})`);

  for (const f of facturas) {
    const suyos = comprados.filter((i) => i.factura_id === f.id);
    if (!suyos.length) continue;
    const extra =
      f.metodo_pago === 'Crédito'
        ? ` · vence ${f.vence ? formatFecha(f.vence) : 'sin fecha'}`
        : f.tasa_bs
          ? ` · ${formatTasa(f.tasa_bs)}`
          : '';
    lineas.push('', `*${f.comercio_nombre ?? 'Sin comercio'}* · ${f.metodo_pago ?? ''} · ${dinero(f.total_usd, f.total_bs)}${extra}`);
    for (const i of suyos) {
      lineas.push(`• ${i.producto_nombre} — ${cant(i.cantidad_comprada, i.unidad)} — ${dinero(i.precio_pagado_usd, i.precio_pagado_bs)}`);
    }
  }

  if (noHabia.length) {
    lineas.push('', '❌ *No había:*');
    for (const i of noHabia) lineas.push(`• ${i.producto_nombre}${i.cantidad_pedida != null ? ` (${cant(i.cantidad_pedida, i.unidad)})` : ''}`);
  }
  if (pendientes.length) {
    lineas.push('', '⏳ *Sin comprar:*');
    for (const i of pendientes) lineas.push(`• ${i.producto_nombre}${i.cantidad_pedida != null ? ` (${cant(i.cantidad_pedida, i.unidad)})` : ''}`);
  }
  return lineas.join('\n');
}

/** Lista en texto que el parser vuelve a entender (para listas frecuentes). */
export function textoLista(items: Pick<ItemResumen, 'producto_nombre' | 'cantidad_pedida' | 'unidad'>[]): string {
  return items
    .map((i) => (i.cantidad_pedida != null ? `${formatCantidad(i.cantidad_pedida)}${i.unidad ? ` ${i.unidad}` : ''} ${i.producto_nombre}` : i.producto_nombre))
    .join('\n');
}

export interface DeudaResumen {
  comercio_nombre: string | null;
  fecha: string;
  vence: string | null;
  total_usd: number;
  saldo_usd: number;
  productos: string | null;
}

/** Estado de un vencimiento: días que faltan (negativo = vencida). null si no tiene fecha. */
export function diasParaVencer(vence: string | null, ahora = new Date()): number | null {
  if (!vence) return null;
  const inicio = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((inicio(new Date(vence)) - inicio(ahora)) / 86_400_000);
}

export function textoVence(vence: string | null, ahora = new Date()): string {
  const d = diasParaVencer(vence, ahora);
  if (d == null) return 'sin fecha de vencimiento';
  if (d < 0) return `VENCIDA hace ${-d} ${d === -1 ? 'día' : 'días'}`;
  if (d === 0) return 'vence HOY';
  return `vence en ${d} ${d === 1 ? 'día' : 'días'} (${formatFecha(vence!)})`;
}

/** Deudas a crédito pendientes, agrupadas por comercio, para pasarlas a quien paga. */
export function textoDeudas(deudas: DeudaResumen[], tasa: number | null, ahora = new Date()): string {
  const total = deudas.reduce((s, d) => s + d.saldo_usd, 0);
  const lineas = [`*Cuentas por pagar al ${formatFecha(ahora.toISOString())}*`, `Total: ${formatUsd(total)}${tasa ? ` (≈ ${formatBs(total * tasa)} a ${formatTasa(tasa)})` : ''}`];
  const grupos = new Map<string, DeudaResumen[]>();
  for (const d of deudas) grupos.set(d.comercio_nombre ?? 'Sin comercio', [...(grupos.get(d.comercio_nombre ?? 'Sin comercio') ?? []), d]);
  for (const [comercio, ds] of grupos) {
    lineas.push('', `*${comercio}* · ${formatUsd(ds.reduce((s, d) => s + d.saldo_usd, 0))}`);
    for (const d of ds) {
      const abonado = d.total_usd - d.saldo_usd;
      lineas.push(
        `• Compra del ${formatFecha(d.fecha)}: ${formatUsd(d.saldo_usd)}${abonado > 0.005 ? ` (de ${formatUsd(d.total_usd)}, abonado ${formatUsd(abonado)})` : ''} — ${textoVence(d.vence, ahora)}`,
      );
      if (d.productos) lineas.push(`   ${d.productos}`);
    }
  }
  return lineas.join('\n');
}
