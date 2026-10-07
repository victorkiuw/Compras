// Exportación de todos los precios registrados a Excel. Sin imports de React Native.
import { fechaCorta } from './reporte.ts';
import type { Celda, Hoja } from './xlsx.ts';

export interface RegistroPrecio {
  producto: string;
  unidad: string | null;
  comercio: string;
  precio_unitario_usd: number | null;
  precio_unitario_bs: number;
  tasa_bs: number | null;
  cantidad: number | null;
  fecha: string;
}

interface ResumenPrecio {
  producto: string;
  comercio: string;
  unidad: string | null;
  ultimoUsd: number | null;
  ultimoBs: number;
  ultimaFecha: string;
  minUsd: number | null;
  maxUsd: number | null;
  promUsd: number | null;
  compras: number;
}

const b = (v: string | number | null) => ({ v, estilo: 'negrita' as const });
const d = (v: number | null | undefined) => ({ v: v == null ? null : Math.round(v * 100) / 100, estilo: 'dinero' as const });
const dn = (v: number | null | undefined) => ({ v: v == null ? null : Math.round(v * 100) / 100, estilo: 'dineroNegrita' as const });
const porNombre = (a: string, c: string) => a.localeCompare(c, 'es', { sensitivity: 'base' });

/** Último, mínimo, máximo y promedio de cada producto en cada comercio. */
export function resumirPrecios(registros: RegistroPrecio[]): ResumenPrecio[] {
  const grupos = new Map<string, RegistroPrecio[]>();
  for (const r of registros) {
    const k = `${r.producto}\u0000${r.comercio}`;
    grupos.set(k, [...(grupos.get(k) ?? []), r]);
  }
  return [...grupos.values()].map((rs) => {
    const ultimo = rs.reduce((a, c) => (c.fecha > a.fecha ? c : a));
    const usd = rs.map((r) => r.precio_unitario_usd).filter((v): v is number => v != null);
    return {
      producto: ultimo.producto,
      comercio: ultimo.comercio,
      unidad: ultimo.unidad,
      ultimoUsd: ultimo.precio_unitario_usd,
      ultimoBs: ultimo.precio_unitario_bs,
      ultimaFecha: ultimo.fecha,
      minUsd: usd.length ? Math.min(...usd) : null,
      maxUsd: usd.length ? Math.max(...usd) : null,
      promUsd: usd.length ? usd.reduce((s, v) => s + v, 0) / usd.length : null,
      compras: rs.length,
    };
  });
}

export function hojasPrecios(registros: RegistroPrecio[], generado = new Date()): Hoja[] {
  const resumen = resumirPrecios(registros);
  const comercios = [...new Set(resumen.map((r) => r.comercio))].sort(porNombre);
  const productos = [...new Set(resumen.map((r) => r.producto))].sort(porNombre);

  // 1) Comparativa: un producto por fila y el último precio en $ de cada negocio en columnas.
  const comparativa: Celda[][] = [
    [{ v: `Precios por negocio · al ${fechaCorta(generado.toISOString())}`, estilo: 'titulo' }],
    ['Último precio por unidad en dólares registrado en cada negocio.'],
    [],
    [b('Producto'), b('Unidad'), ...comercios.map(b), b('Más barato en'), b('Mejor precio $'), b('Diferencia %')],
  ];
  for (const producto of productos) {
    const filas = resumen.filter((r) => r.producto === producto);
    const conUsd = filas.filter((r) => r.ultimoUsd != null).sort((x, y) => x.ultimoUsd! - y.ultimoUsd!);
    const mejor = conUsd[0];
    const peor = conUsd[conUsd.length - 1];
    const dif = conUsd.length > 1 && peor.ultimoUsd ? ((peor.ultimoUsd - mejor.ultimoUsd!) / peor.ultimoUsd) * 100 : null;
    comparativa.push([
      producto,
      filas.find((r) => r.unidad)?.unidad ?? null,
      ...comercios.map((c) => {
        const r = filas.find((x) => x.comercio === c);
        return r?.ultimoUsd != null ? (r === mejor && conUsd.length > 1 ? dn(r.ultimoUsd) : d(r.ultimoUsd)) : null;
      }),
      mejor?.comercio ?? null,
      d(mejor?.ultimoUsd),
      dif != null ? Math.round(dif) : null,
    ]);
  }

  // 2) Por negocio: cada negocio con sus productos ordenados del más barato al más caro.
  const porNegocio: Celda[][] = [
    [b('Negocio'), b('Producto'), b('Unidad'), b('Último $'), b('Último Bs.'), b('Fecha último'), b('Mínimo $'), b('Máximo $'), b('Promedio $'), b('Compras')],
  ];
  for (const comercio of comercios) {
    const filas = resumen
      .filter((r) => r.comercio === comercio)
      .sort((x, y) => (x.ultimoUsd ?? Infinity) - (y.ultimoUsd ?? Infinity) || porNombre(x.producto, y.producto));
    for (const r of filas) {
      porNegocio.push([
        comercio,
        r.producto,
        r.unidad,
        d(r.ultimoUsd),
        d(r.ultimoBs),
        fechaCorta(r.ultimaFecha),
        d(r.minUsd),
        d(r.maxUsd),
        d(r.promUsd),
        r.compras,
      ]);
    }
  }

  // 3) Todos los registros: cada compra, agrupada por producto y del precio más bajo al más alto.
  const todos: Celda[][] = [
    [b('Producto'), b('Negocio'), b('Unidad'), b('Precio $'), b('Precio Bs.'), b('Tasa Bs/$'), b('Cantidad'), b('Fecha')],
    ...[...registros]
      .sort(
        (x, y) =>
          porNombre(x.producto, y.producto) ||
          (x.precio_unitario_usd ?? Infinity) - (y.precio_unitario_usd ?? Infinity) ||
          x.precio_unitario_bs - y.precio_unitario_bs,
      )
      .map((r) => [r.producto, r.comercio, r.unidad, d(r.precio_unitario_usd), d(r.precio_unitario_bs), d(r.tasa_bs), r.cantidad, fechaCorta(r.fecha)]),
  ];

  return [
    { nombre: 'Comparativa', filas: comparativa, anchos: [28, 10, ...comercios.map(() => 14), 18, 14, 12] },
    { nombre: 'Por negocio', filas: porNegocio, anchos: [18, 28, 10, 12, 14, 12, 12, 12, 12, 9], fijarEncabezado: true },
    { nombre: 'Todos los precios', filas: todos, anchos: [28, 18, 10, 12, 14, 12, 10, 12], fijarEncabezado: true },
  ];
}
