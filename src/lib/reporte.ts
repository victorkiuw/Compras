// Arma el reporte semanal (hojas de Excel) a partir de los datos de la base. Sin imports de React Native.
import type { Celda, Hoja } from './xlsx.ts';

export interface CompraReporte {
  factura_id: number;
  fecha: string;
  comercio: string | null;
  metodo_pago: string | null;
  tasa_bs: number | null;
  producto: string;
  cantidad: number | null;
  unidad: string | null;
  total_usd: number | null;
  total_bs: number | null;
}

export interface CreditoReporte {
  comercio_nombre: string | null;
  fecha: string;
  vence: string | null;
  total_usd: number;
  abonado_usd: number;
  saldo_usd: number;
  productos: string | null;
}

export interface EntradaReporte {
  compras: CompraReporte[];
  noHabia: { fecha: string; producto: string; cantidad: number | null; unidad: string | null }[];
  abonos: { fecha: string; comercio: string | null; monto_usd: number; nota: string | null }[];
  creditosPendientes: CreditoReporte[];
}

const pad = (n: number) => String(n).padStart(2, '0');
export const fechaCorta = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/** Lunes 00:00 (hora local) de la semana que contiene `fecha`. */
export function inicioSemana(fecha: Date): Date {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function rangoSemana(inicio: Date): { desde: Date; hasta: Date; titulo: string } {
  const hasta = new Date(inicio);
  hasta.setDate(hasta.getDate() + 7);
  const domingo = new Date(hasta);
  domingo.setDate(domingo.getDate() - 1);
  return { desde: inicio, hasta, titulo: `${fechaCorta(inicio.toISOString())} al ${fechaCorta(domingo.toISOString())}` };
}

export interface ResumenSemana {
  pagadoBs: number;
  pagadoUsd: number;
  creditoUsd: number;
  facturas: number;
  productos: number;
  porMetodo: { metodo: string; bs: number; usd: number }[];
  porComercio: { comercio: string; bs: number; usd: number; creditoUsd: number; facturas: number }[];
  porProducto: { producto: string; unidad: string | null; cantidad: number; usd: number; bs: number; mejorComercio: string | null; mejorUsd: number | null }[];
}

export function resumirSemana(e: EntradaReporte): ResumenSemana {
  const r: ResumenSemana = { pagadoBs: 0, pagadoUsd: 0, creditoUsd: 0, facturas: 0, productos: e.compras.length, porMetodo: [], porComercio: [], porProducto: [] };
  const metodos = new Map<string, { bs: number; usd: number }>();
  const comercios = new Map<string, { bs: number; usd: number; creditoUsd: number; facturas: Set<number> }>();
  const productos = new Map<string, ResumenSemana['porProducto'][number]>();
  const facturas = new Set<number>();

  for (const c of e.compras) {
    const credito = c.metodo_pago === 'Crédito';
    const usd = c.total_usd ?? 0;
    const bs = c.total_bs ?? 0;
    facturas.add(c.factura_id);
    if (credito) r.creditoUsd += usd;
    else {
      r.pagadoBs += bs;
      r.pagadoUsd += usd;
    }
    const m = metodos.get(c.metodo_pago ?? 'Sin dato') ?? { bs: 0, usd: 0 };
    metodos.set(c.metodo_pago ?? 'Sin dato', { bs: m.bs + bs, usd: m.usd + usd });

    const k = c.comercio ?? 'Sin comercio';
    const co = comercios.get(k) ?? { bs: 0, usd: 0, creditoUsd: 0, facturas: new Set<number>() };
    if (credito) co.creditoUsd += usd;
    else {
      co.bs += bs;
      co.usd += usd;
    }
    co.facturas.add(c.factura_id);
    comercios.set(k, co);

    const kp = `${c.producto}|${c.unidad ?? ''}`;
    const p = productos.get(kp) ?? { producto: c.producto, unidad: c.unidad, cantidad: 0, usd: 0, bs: 0, mejorComercio: null, mejorUsd: null };
    p.cantidad += c.cantidad ?? 0;
    p.usd += usd;
    p.bs += bs;
    const unitario = c.total_usd != null && c.cantidad ? c.total_usd / c.cantidad : null;
    if (unitario != null && (p.mejorUsd == null || unitario < p.mejorUsd)) {
      p.mejorUsd = unitario;
      p.mejorComercio = c.comercio;
    }
    productos.set(kp, p);
  }
  r.facturas = facturas.size;
  r.porMetodo = [...metodos.entries()].map(([metodo, v]) => ({ metodo, ...v })).sort((a, b) => b.usd - a.usd);
  r.porComercio = [...comercios.entries()]
    .map(([comercio, v]) => ({ comercio, bs: v.bs, usd: v.usd, creditoUsd: v.creditoUsd, facturas: v.facturas.size }))
    .sort((a, b) => b.usd + b.creditoUsd - (a.usd + a.creditoUsd));
  r.porProducto = [...productos.values()].sort((a, b) => b.usd - a.usd);
  return r;
}

const b = (v: string | number | null) => ({ v, estilo: 'negrita' as const });
const d = (v: number | null) => ({ v: v == null ? null : Math.round(v * 100) / 100, estilo: 'dinero' as const });
const dn = (v: number | null) => ({ v: v == null ? null : Math.round(v * 100) / 100, estilo: 'dineroNegrita' as const });

export function hojasReporte(e: EntradaReporte, titulo: string, generado = new Date()): Hoja[] {
  const r = resumirSemana(e);
  const deudaTotal = e.creditosPendientes.reduce((s, c) => s + c.saldo_usd, 0);

  const resumen: Celda[][] = [
    [{ v: `Reporte de compras · semana del ${titulo}`, estilo: 'titulo' }],
    [`Generado el ${fechaCorta(generado.toISOString())}`],
    [],
    [b('Concepto'), b('Bs.'), b('$')],
    ['Pagado en la semana', d(r.pagadoBs), d(r.pagadoUsd)],
    ['Comprado a crédito', null, d(r.creditoUsd)],
    [b('Total comprado'), dn(r.pagadoBs), dn(r.pagadoUsd + r.creditoUsd)],
    ['Pagos de créditos hechos en la semana', null, d(e.abonos.reduce((s, a) => s + a.monto_usd, 0))],
    ['Deuda pendiente total (a hoy)', null, d(deudaTotal)],
    [],
    ['Facturas', r.facturas],
    ['Productos comprados', r.productos],
    ['Productos que no había', e.noHabia.length],
    [],
    [b('Por método de pago'), b('Bs.'), b('$')],
    ...r.porMetodo.map((m) => [m.metodo, d(m.metodo === 'Crédito' ? null : m.bs), d(m.usd)]),
    [],
    [b('Por comercio'), b('Pagado Bs.'), b('Pagado $'), b('Crédito $'), b('Facturas')],
    ...r.porComercio.map((c) => [c.comercio, d(c.bs), d(c.usd), d(c.creditoUsd), c.facturas]),
  ];

  const compras: Celda[][] = [
    [b('Fecha'), b('Comercio'), b('Método'), b('Producto'), b('Cantidad'), b('Unidad'), b('Precio unit. $'), b('Total $'), b('Total Bs.'), b('Tasa Bs/$'), b('Factura')],
    ...e.compras.map((c) => [
      fechaCorta(c.fecha),
      c.comercio,
      c.metodo_pago,
      c.producto,
      c.cantidad,
      c.unidad,
      d(c.total_usd != null && c.cantidad ? c.total_usd / c.cantidad : null),
      d(c.total_usd),
      d(c.total_bs),
      d(c.tasa_bs),
      c.factura_id,
    ]),
    [],
    [b('Totales'), null, null, null, null, null, null, dn(r.pagadoUsd + r.creditoUsd), dn(e.compras.reduce((s, c) => s + (c.total_bs ?? 0), 0))],
  ];

  const productos: Celda[][] = [
    [b('Producto'), b('Cantidad'), b('Unidad'), b('Gastado $'), b('Gastado Bs.'), b('Precio prom. $'), b('Más barato en'), b('Mejor precio $')],
    ...r.porProducto.map((p) => [p.producto, p.cantidad, p.unidad, d(p.usd), d(p.bs), d(p.cantidad ? p.usd / p.cantidad : null), p.mejorComercio, d(p.mejorUsd)]),
  ];

  const creditos: Celda[][] = [
    [b('Comercio'), b('Fecha compra'), b('Vence'), b('Total $'), b('Abonado $'), b('Saldo $'), b('Productos')],
    ...e.creditosPendientes.map((c) => [
      c.comercio_nombre,
      fechaCorta(c.fecha),
      c.vence ? fechaCorta(c.vence) : 'Sin fecha',
      d(c.total_usd),
      d(c.abonado_usd),
      dn(c.saldo_usd),
      c.productos,
    ]),
    [],
    [b('Total adeudado'), null, null, null, null, dn(deudaTotal)],
    [],
    [b('Pagos hechos en la semana'), b('Fecha'), b('Monto $'), b('Nota')],
    ...e.abonos.map((a) => [a.comercio, fechaCorta(a.fecha), d(a.monto_usd), a.nota]),
  ];

  const noHabia: Celda[][] = [
    [b('Fecha'), b('Producto'), b('Cantidad pedida'), b('Unidad')],
    ...e.noHabia.map((n) => [fechaCorta(n.fecha), n.producto, n.cantidad, n.unidad]),
  ];

  return [
    { nombre: 'Resumen', filas: resumen, anchos: [40, 16, 16, 14, 10] },
    { nombre: 'Compras', filas: compras, anchos: [12, 18, 12, 28, 10, 10, 14, 12, 14, 12, 9], fijarEncabezado: true },
    { nombre: 'Productos', filas: productos, anchos: [28, 10, 10, 12, 14, 14, 18, 14], fijarEncabezado: true },
    { nombre: 'Créditos', filas: creditos, anchos: [20, 14, 12, 12, 12, 12, 40], fijarEncabezado: true },
    { nombre: 'No había', filas: noHabia, anchos: [12, 28, 16, 10], fijarEncabezado: true },
  ];
}
