// Cálculo de ahorro / sobrecosto por comercio para un producto.
// Todo se compara en dólares para que la inflación del bolívar no distorsione.

export interface CompraRegistrada {
  comercio_id: number;
  comercio_nombre: string;
  precio_unitario_usd: number | null;
  cantidad: number | null;
  fecha: string;
}

export interface ResumenComercio {
  comercioId: number;
  nombre: string;
  compras: number;
  cantidad: number;
  gastadoUsd: number;
  promedioUsd: number;
  minimoUsd: number;
  maximoUsd: number;
  ultimoUsd: number;
  ultimaFecha: string;
  /** Positivo: ahorraste frente a tu precio promedio del producto. Negativo: pagaste de más. */
  diferenciaUsd: number;
}

export interface ResumenProducto {
  compras: number;
  cantidad: number;
  gastadoUsd: number;
  promedioUsd: number;
  minimo: { usd: number; comercio: string; fecha: string };
  maximo: { usd: number; comercio: string; fecha: string };
  /** Comercios ordenados del promedio más barato al más caro. */
  porComercio: ResumenComercio[];
  /** Lo que habrías ahorrado comprando todo al precio promedio del comercio más barato. */
  sobrecostoVsMejorUsd: number;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

export function calcularResumen(registros: CompraRegistrada[]): ResumenProducto | null {
  const validos = registros
    .filter((r): r is CompraRegistrada & { precio_unitario_usd: number } => r.precio_unitario_usd != null && r.precio_unitario_usd > 0)
    .map((r) => ({ ...r, q: r.cantidad && r.cantidad > 0 ? r.cantidad : 1 }));
  if (!validos.length) return null;

  const cantidad = validos.reduce((s, r) => s + r.q, 0);
  const gastado = validos.reduce((s, r) => s + r.precio_unitario_usd * r.q, 0);
  const promedio = gastado / cantidad;

  const grupos = new Map<number, typeof validos>();
  for (const r of validos) grupos.set(r.comercio_id, [...(grupos.get(r.comercio_id) ?? []), r]);

  const porComercio: ResumenComercio[] = [...grupos.values()].map((rs) => {
    const q = rs.reduce((s, r) => s + r.q, 0);
    const g = rs.reduce((s, r) => s + r.precio_unitario_usd * r.q, 0);
    const ultimo = rs.reduce((a, b) => (b.fecha > a.fecha ? b : a));
    return {
      comercioId: rs[0].comercio_id,
      nombre: rs[0].comercio_nombre,
      compras: rs.length,
      cantidad: q,
      gastadoUsd: redondear(g),
      promedioUsd: g / q,
      minimoUsd: Math.min(...rs.map((r) => r.precio_unitario_usd)),
      maximoUsd: Math.max(...rs.map((r) => r.precio_unitario_usd)),
      ultimoUsd: ultimo.precio_unitario_usd,
      ultimaFecha: ultimo.fecha,
      diferenciaUsd: redondear(rs.reduce((s, r) => s + (promedio - r.precio_unitario_usd) * r.q, 0)),
    };
  });
  porComercio.sort((a, b) => a.promedioUsd - b.promedioUsd);

  const mejor = porComercio[0].promedioUsd;
  const sobrecosto = validos.reduce((s, r) => s + Math.max(0, r.precio_unitario_usd - mejor) * r.q, 0);

  const min = validos.reduce((a, b) => (b.precio_unitario_usd < a.precio_unitario_usd ? b : a));
  const max = validos.reduce((a, b) => (b.precio_unitario_usd > a.precio_unitario_usd ? b : a));

  return {
    compras: validos.length,
    cantidad,
    gastadoUsd: redondear(gastado),
    promedioUsd: promedio,
    minimo: { usd: min.precio_unitario_usd, comercio: min.comercio_nombre, fecha: min.fecha },
    maximo: { usd: max.precio_unitario_usd, comercio: max.comercio_nombre, fecha: max.fecha },
    porComercio,
    sobrecostoVsMejorUsd: porComercio.length > 1 ? redondear(sobrecosto) : 0,
  };
}

/** Variación porcentual de cada compra frente a la anterior en el mismo comercio (clave: índice). */
export function variacionesPorComercio(registros: CompraRegistrada[]): Map<number, number> {
  const orden = registros.map((r, i) => ({ r, i })).sort((a, b) => a.r.fecha.localeCompare(b.r.fecha));
  const anterior = new Map<number, number>();
  const res = new Map<number, number>();
  for (const { r, i } of orden) {
    if (r.precio_unitario_usd == null) continue;
    const prev = anterior.get(r.comercio_id);
    if (prev) res.set(i, ((r.precio_unitario_usd - prev) / prev) * 100);
    anterior.set(r.comercio_id, r.precio_unitario_usd);
  }
  return res;
}
