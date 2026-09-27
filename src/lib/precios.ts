import type { PrecioComercio } from '../db/repo';
import { formatBs, formatUsd } from './format';

/** Muestra el precio unitario en dólares si se conoce; si no, en bolívares. */
export function formatPrecioRef(p: Pick<PrecioComercio, 'precio_unitario_usd' | 'precio_unitario_bs'>): string {
  return p.precio_unitario_usd != null ? formatUsd(p.precio_unitario_usd) : formatBs(p.precio_unitario_bs);
}

/** Equivalente en Bs. a la tasa de hoy de un precio guardado en dólares. */
export function bsHoy(p: Pick<PrecioComercio, 'precio_unitario_usd'>, tasa: number | null): number | null {
  return p.precio_unitario_usd != null && tasa ? p.precio_unitario_usd * tasa : null;
}
