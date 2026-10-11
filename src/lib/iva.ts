// IVA venezolano para las facturas de compra. Sin imports de React Native.
import { normalizarNombre } from './parser.ts';

/** Alícuota general del IVA en Venezuela. */
export const IVA_GENERAL = 16;

// Productos que la Ley del IVA (art. 18) suele tratar como exentos: canasta alimentaria
// básica en estado natural o con poco procesamiento. Es solo una SUGERENCIA: el usuario
// decide en cada factura y la app recuerda su decisión por producto.
const EXENTOS: RegExp[] = [
  /\barroz\b/,
  /\bharina\b/,
  /\b(pasta|pastas|espagueti|espaguetis|fideo|fideos|tallarin|tallarines|macarron|macarrones|vermicelli)\b/,
  /\bpan\b/,
  /\b(azucar|papelon)\b/,
  /\bsal\b/,
  /\bcafe\b/,
  /\bavena\b/,
  /\b(maiz|caraota|caraotas|frijol|frijoles|lenteja|lentejas|arveja|arvejas|quinchoncho|granos?)\b/,
  /\b(pollo|gallina|muslo|muslos|pechuga|pechugas|alas)\b/,
  /\b(carne|res|cerdo|cochino|chuleta|chuletas|costilla|costillas|molida|bistec|lomo|chivo|cordero|higado|mondongo|pernil)\b/,
  /\b(pescado|sardina|sardinas|atun|merluza|cazon|bagre|curvina|camaron|camarones)\b/,
  /\b(huevo|huevos)\b/,
  /\bmortadela\b/,
  /\bleche\b/,
  /\bqueso blanco\b/,
  /\b(margarina|mantequilla|mayonesa|vinagre)\b/,
  /\bsalsa de tomate\b/,
  /\baceite\b/,
  // Frutas, verduras, hortalizas y víveres en estado natural.
  /\b(tomate|tomates|cebolla|cebollas|papa|papas|platano|platanos|cambur|cambures|yuca|ocumo|name|auyama|zanahoria|zanahorias|pimenton|pimentones|aji|ajies|ajo|ajos|lechuga|repollo|pepino|pepinos|berenjena|calabacin|celery|apio|cilantro|perejil|cebollin|ajoporro|remolacha|batata|brocoli|coliflor|espinaca|limon|limones|naranja|naranjas|mandarina|aguacate|aguacates|mango|mangos|pina|patilla|melon|lechosa|guayaba|parchita|fresa|fresas|manzana|manzanas|pera|peras|uva|uvas|coco|verdura|verduras|fruta|frutas|hortaliza|hortalizas)\b/,
];

// Aunque coincidan con lo anterior, estos llevan IVA (procesados, importados o de lujo).
const GRAVADOS: RegExp[] = [
  /\baceite de oliva\b/,
  /\bsalsa\b(?! de tomate)/,
  /\b(jamon|salchicha|salchichas|tocineta|chorizo|pate|nuggets|empanizad[oa]s?)\b/,
  /\b(galleta|galletas|torta|tortas|ponque|chocolate|caramelo|refresco|refrescos|jugo|jugos|gaseosa|malta|cerveza|ron|whisky|vino)\b/,
  /\bqueso (amarillo|gouda|mozzarella|parmesano|crema|fundido|cheddar|pecorino)\b/,
  /\b(helado|helados|yogur|yogurt|crema de leche|leche condensada|chantilly)\b/,
  /\bharina de (trigo leudante|reposteria)\b/,
  /\bpan (dulce|de jamon|de guayaba|pita|arabe|integral de molde)\b/,
  /\bcafe (instantaneo|soluble|capuchino)\b/,
  /\b(detergente|jabon|cloro|desinfectante|suavizante|papel|servilleta|servilletas|bolsa|bolsas|vaso|vasos|plato|platos|envase|envases|pitillo|pitillos|aluminio|film|gas|carbon|esponja|lavaplatos)\b/,
];

/** true si el producto probablemente está exento de IVA según su nombre. */
export function sugerirExento(nombre: string): boolean {
  const n = normalizarNombre(nombre);
  if (GRAVADOS.some((r) => r.test(n))) return false;
  return EXENTOS.some((r) => r.test(n));
}

/** Monto con IVA incluido a partir de la base. */
export const conIva = (base: number, pct: number) => base * (1 + pct / 100);

/** Base imponible a partir de un monto con IVA incluido. */
export const sinIva = (total: number, pct: number) => total / (1 + pct / 100);

export interface DesgloseIva {
  base: number;
  exento: number;
  gravado: number;
  iva: number;
  total: number;
}

/** Desglose de una factura: líneas con su base (sin IVA) y si son exentas. */
export function desglosarIva(lineas: { base: number; exento: boolean }[], pct = IVA_GENERAL): DesgloseIva {
  const exento = lineas.filter((l) => l.exento).reduce((s, l) => s + l.base, 0);
  const gravado = lineas.filter((l) => !l.exento).reduce((s, l) => s + l.base, 0);
  const iva = (gravado * pct) / 100;
  return { base: exento + gravado, exento, gravado, iva, total: exento + gravado + iva };
}
