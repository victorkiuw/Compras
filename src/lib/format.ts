// Formato numérico venezolano: punto para miles, coma para decimales.

export function formatNumero(n: number, decimales = 2): string {
  if (!Number.isFinite(n)) return '0';
  const negativo = n < 0;
  const fijo = Math.abs(n).toFixed(decimales);
  const [entero, dec] = fijo.split('.');
  const miles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (negativo ? '-' : '') + (dec ? `${miles},${dec}` : miles);
}

export function formatBs(n: number | null | undefined): string {
  return `Bs. ${formatNumero(n ?? 0, 2)}`;
}

export function formatUsd(n: number | null | undefined): string {
  return `$${formatNumero(n ?? 0, 2)}`;
}

/** "36,50 Bs/$" */
export function formatTasa(tasa: number | null | undefined): string {
  return tasa ? `${formatNumero(tasa, 2)} Bs/$` : 'sin tasa';
}

export type Moneda = 'USD' | 'BS';

/** Convierte un monto a ambas monedas usando la tasa (Bs por dólar). */
export function convertir(monto: number, moneda: Moneda, tasa: number | null): { usd: number | null; bs: number | null } {
  if (moneda === 'USD') return { usd: monto, bs: tasa ? monto * tasa : null };
  return { usd: tasa ? monto / tasa : null, bs: monto };
}

/** Cantidad sin decimales innecesarios: 2 → "2", 1.5 → "1,5". */
export function formatCantidad(n: number | null | undefined): string {
  if (n == null) return '';
  const redondeado = Math.round(n * 1000) / 1000;
  if (Number.isInteger(redondeado)) return formatNumero(redondeado, 0);
  return formatNumero(redondeado, 3).replace(/0+$/, '').replace(/,$/, '');
}

/**
 * Interpreta un monto escrito a mano. Acepta "1.234,56", "1234,56", "1234.56",
 * "1,234.56" y "1.500" (miles). Devuelve null si no es un número válido.
 */
export function parseMonto(texto: string): number | null {
  let s = texto.replace(/bs\.?/i, '').replace(/\s/g, '');
  if (!s) return null;
  const ultimaComa = s.lastIndexOf(',');
  const ultimoPunto = s.lastIndexOf('.');
  if (ultimaComa >= 0 && ultimoPunto >= 0) {
    // El separador que aparece de último es el decimal.
    if (ultimaComa > ultimoPunto) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (ultimaComa >= 0) {
    s = /^\d{1,3}(,\d{3}){2,}$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (ultimoPunto >= 0 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const pad = (n: number) => String(n).padStart(2, '0');

export function formatFecha(iso: string): string {
  const d = new Date(iso);
  return `${DIAS[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatFechaHora(iso: string): string {
  const d = new Date(iso);
  return `${formatFecha(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function haceCuanto(iso: string, ahora = new Date()): string {
  const inicio = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((inicio(ahora) - inicio(new Date(iso))) / 86_400_000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? 'hace 1 mes' : `hace ${meses} meses`;
}
