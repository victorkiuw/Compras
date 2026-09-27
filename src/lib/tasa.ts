// Obtención automática de la tasa Bs/$ desde servicios públicos.
// Sin imports de React Native para poder probarlo con Node.

export type TipoTasa = 'oficial' | 'paralelo';

export interface TasaObtenida {
  tasa: number;
  /** Fecha de publicación según la fuente (ISO), si la informa. */
  fecha: string | null;
  fuente: string;
}

// Límites de cordura: descarta respuestas absurdas (0, textos, errores de la API).
const MIN = 1;
const MAX = 10_000_000;
const esTasa = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= MIN && n <= MAX;

function aNumero(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const limpio = v.replace(/[^\d.,]/g, '');
    // "36,50" o "1.234,56" (formato venezolano) o "36.50"
    const n = limpio.includes(',') ? parseFloat(limpio.replace(/\./g, '').replace(',', '.')) : parseFloat(limpio);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const CAMPOS_PRECIO = ['promedio', 'price', 'venta', 'valor', 'value', 'rate', 'compra'];
const CAMPOS_FECHA = ['fechaActualizacion', 'fecha', 'last_update', 'lastUpdate', 'updated_at', 'date', 'datetime'];
const PALABRAS: Record<TipoTasa, RegExp> = {
  oficial: /oficial|bcv|banco central/i,
  paralelo: /paralelo|enparalelo|monitor/i,
};

function precioDe(obj: Record<string, unknown>): number | null {
  for (const campo of CAMPOS_PRECIO) {
    const n = aNumero(obj[campo]);
    if (esTasa(n)) return n;
  }
  return null;
}

function fechaDe(obj: Record<string, unknown>): string | null {
  for (const campo of CAMPOS_FECHA) {
    const v = obj[campo];
    if (typeof v === 'string' && v) {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
  }
  return null;
}

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Extrae la tasa de una respuesta JSON. Acepta:
 * - un objeto con precio (`{ fuente: 'oficial', promedio: 36.5, fechaActualizacion }`)
 * - una lista de objetos, eligiendo el que corresponde al tipo
 * - objetos anidados por clave (`{ monitors: { bcv: { price } } }`)
 */
export function extraerTasa(json: unknown, tipo: TipoTasa): { tasa: number; fecha: string | null } | null {
  const candidatos: { obj: Record<string, unknown>; etiqueta: string }[] = [];
  const visitar = (v: unknown, etiqueta: string, profundidad: number) => {
    if (profundidad > 4) return;
    if (Array.isArray(v)) {
      v.forEach((x) => visitar(x, etiqueta, profundidad + 1));
    } else if (esObjeto(v)) {
      const nombre = [v.fuente, v.nombre, v.name, v.title, v.key].filter((x) => typeof x === 'string').join(' ');
      candidatos.push({ obj: v, etiqueta: `${etiqueta} ${nombre}` });
      for (const [k, hijo] of Object.entries(v)) {
        if (typeof hijo === 'object') visitar(hijo, `${etiqueta} ${k}`, profundidad + 1);
      }
    }
  };
  visitar(json, '', 0);

  const conPrecio = candidatos.map((c) => ({ ...c, precio: precioDe(c.obj) })).filter((c) => c.precio != null);
  if (!conPrecio.length) return null;
  const otro: TipoTasa = tipo === 'oficial' ? 'paralelo' : 'oficial';
  const elegido =
    conPrecio.find((c) => PALABRAS[tipo].test(c.etiqueta) && !PALABRAS[otro].test(c.etiqueta)) ??
    conPrecio.find((c) => PALABRAS[tipo].test(c.etiqueta)) ??
    // Una sola cifra sin etiqueta: se asume que es la pedida (endpoint específico).
    (conPrecio.length === 1 && !PALABRAS[otro].test(conPrecio[0].etiqueta) ? conPrecio[0] : undefined);
  if (!elegido) return null;
  return { tasa: elegido.precio!, fecha: fechaDe(elegido.obj) };
}

interface Fuente {
  nombre: string;
  url: (tipo: TipoTasa) => string;
}

// Se prueban en orden; si una falla o cambia su formato, se pasa a la siguiente.
export const FUENTES: Fuente[] = [
  { nombre: 'DolarApi', url: (t) => `https://ve.dolarapi.com/v1/dolares/${t}` },
  { nombre: 'DolarApi', url: () => 'https://ve.dolarapi.com/v1/dolares' },
  { nombre: 'PyDolarVe', url: (t) => `https://pydolarve.org/api/v2/dollar?page=${t === 'oficial' ? 'bcv' : 'enparalelovzla'}` },
];

type FetchFn = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

export async function obtenerTasa(tipo: TipoTasa, fetchFn: FetchFn = fetch, timeoutMs = 8000): Promise<TasaObtenida | null> {
  for (const fuente of FUENTES) {
    const control = new AbortController();
    const timer = setTimeout(() => control.abort(), timeoutMs);
    try {
      const res = await fetchFn(fuente.url(tipo), { signal: control.signal, headers: { Accept: 'application/json' } });
      if (!res.ok) continue;
      const r = extraerTasa(await res.json(), tipo);
      if (r) return { ...r, fuente: fuente.nombre };
    } catch {
      // Sin conexión, tiempo agotado o JSON inválido: se intenta la siguiente fuente.
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
