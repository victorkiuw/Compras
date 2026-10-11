// Secciones (tipos) de comercio. Sin imports de React Native.

export interface Seccion {
  nombre: string;
  /** Nombre de ícono de Ionicons. */
  icono: string;
}

/** Secciones predefinidas, en el orden en que se muestran. El usuario puede crear otras. */
export const SECCIONES: Seccion[] = [
  { nombre: 'Supermercado', icono: 'cart-outline' },
  { nombre: 'Mayorista', icono: 'business-outline' },
  { nombre: 'Carnicería', icono: 'restaurant-outline' },
  { nombre: 'Charcutería', icono: 'fast-food-outline' },
  { nombre: 'Pescadería', icono: 'fish-outline' },
  { nombre: 'Frutería y verdulería', icono: 'nutrition-outline' },
  { nombre: 'Panadería', icono: 'cafe-outline' },
  { nombre: 'Bodega', icono: 'basket-outline' },
  { nombre: 'Farmacia', icono: 'medkit-outline' },
  { nombre: 'Licorería', icono: 'wine-outline' },
  { nombre: 'Ferretería', icono: 'hammer-outline' },
  { nombre: 'Otro', icono: 'storefront-outline' },
];

const ICONO_OTRA = 'pricetag-outline';

export function iconoSeccion(nombre: string | null | undefined): string {
  return SECCIONES.find((s) => s.nombre === nombre)?.icono ?? ICONO_OTRA;
}

/** Posición para ordenar: primero las predefinidas en su orden, luego las propias alfabéticamente. */
export function ordenSeccion(nombre: string): number {
  const i = SECCIONES.findIndex((s) => s.nombre === nombre);
  return i === -1 ? SECCIONES.length : i;
}

export function compararSecciones(a: string, b: string): number {
  return ordenSeccion(a) - ordenSeccion(b) || a.localeCompare(b, 'es', { sensitivity: 'base' });
}

/** Agrupa comercios por sección, con las secciones ordenadas y los comercios por nombre. */
export function agruparPorSeccion<T extends { nombre: string; tipo: string }>(comercios: T[]): { seccion: string; comercios: T[] }[] {
  const grupos = new Map<string, T[]>();
  for (const c of comercios) {
    const k = c.tipo?.trim() || 'Otro';
    grupos.set(k, [...(grupos.get(k) ?? []), c]);
  }
  return [...grupos.entries()]
    .sort((a, b) => compararSecciones(a[0], b[0]))
    .map(([seccion, cs]) => ({ seccion, comercios: cs.sort((x, y) => x.nombre.localeCompare(y.nombre, 'es', { sensitivity: 'base' })) }));
}

/** Todas las secciones disponibles: las predefinidas más las propias ya usadas. */
export function seccionesDisponibles(usadas: string[]): string[] {
  const propias = usadas.filter((u) => u && !SECCIONES.some((s) => s.nombre === u));
  return [...SECCIONES.map((s) => s.nombre), ...[...new Set(propias)].sort((a, b) => a.localeCompare(b, 'es'))];
}
