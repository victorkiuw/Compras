// Unidades pequeñas que se cotizan por su unidad grande: el precio de gramos se da por kilo
// y el de mililitros por litro. Sin imports de React Native.

const CONVERSIONES: Record<string, { base: string; factor: number }> = {
  g: { base: 'Kg', factor: 1000 },
  ml: { base: 'L', factor: 1000 },
};

/** Si la unidad se cotiza por otra más grande (g → Kg, ml → L), devuelve cuál y el factor. */
export function unidadDePrecio(unidad: string | null | undefined): { base: string; factor: number } | null {
  return unidad ? (CONVERSIONES[unidad] ?? null) : null;
}

/** Cantidad expresada en la unidad del precio: 500 g → 0,5 (Kg). Otras unidades no cambian. */
export function cantidadDePrecio(cantidad: number, unidad: string | null | undefined): number {
  const c = unidadDePrecio(unidad);
  return c ? cantidad / c.factor : cantidad;
}

/** Nombre de la unidad del precio: «Kg» para gramos, «L» para ml, la misma en otros casos. */
export function nombreUnidadPrecio(unidad: string | null | undefined): string | null {
  return unidadDePrecio(unidad)?.base ?? unidad ?? null;
}

/** Paso de los botones +/− según la unidad (de 50 en 50 para gramos y ml). */
export function pasoDeCantidad(unidad: string | null | undefined): number {
  return unidadDePrecio(unidad) ? 50 : 1;
}
