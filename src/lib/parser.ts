// Convierte el texto de un mensaje de WhatsApp en ítems de compra.

export interface ItemParseado {
  nombre: string;
  cantidad: number | null;
  unidad: string | null;
  original: string;
}

// Alias escritos → nombre canónico de la unidad.
const UNIDADES: Record<string, string> = {
  kg: 'Kg', kgs: 'Kg', k: 'Kg', kilo: 'Kg', kilos: 'Kg', kilogramo: 'Kg', kilogramos: 'Kg',
  g: 'g', gr: 'g', grs: 'g', gramo: 'g', gramos: 'g',
  l: 'L', lt: 'L', lts: 'L', litro: 'L', litros: 'L',
  ml: 'ml',
  caja: 'Caja', cajas: 'Caja',
  paquete: 'Paquete', paquetes: 'Paquete', paq: 'Paquete', pqt: 'Paquete', pqts: 'Paquete',
  bulto: 'Bulto', bultos: 'Bulto',
  saco: 'Saco', sacos: 'Saco',
  fardo: 'Fardo', fardos: 'Fardo',
  unidad: 'Unidad', unidades: 'Unidad', und: 'Unidad', unds: 'Unidad', un: 'Unidad', u: 'Unidad',
  docena: 'Docena', docenas: 'Docena',
  carton: 'Cartón', cartones: 'Cartón',
  bolsa: 'Bolsa', bolsas: 'Bolsa',
  lata: 'Lata', latas: 'Lata',
  botella: 'Botella', botellas: 'Botella',
  galon: 'Galón', galones: 'Galón',
  pote: 'Pote', potes: 'Pote',
  rollo: 'Rollo', rollos: 'Rollo',
  sobre: 'Sobre', sobres: 'Sobre',
  bandeja: 'Bandeja', bandejas: 'Bandeja',
  frasco: 'Frasco', frascos: 'Frasco',
  pieza: 'Pieza', piezas: 'Pieza', pz: 'Pieza', pzas: 'Pieza',
  manojo: 'Manojo', manojos: 'Manojo',
};

const NUMEROS_ESCRITOS: Record<string, number> = {
  medio: 0.5, media: 0.5, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, doce: 12, quince: 15, veinte: 20,
};

const quitarAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Clave para identificar el mismo producto aunque se escriba distinto. */
export function normalizarNombre(nombre: string): string {
  return quitarAcentos(nombre).toLowerCase().replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function unidadCanonica(palabra: string | undefined): string | null {
  if (!palabra) return null;
  return UNIDADES[quitarAcentos(palabra).toLowerCase().replace(/\.$/, '')] ?? null;
}

function leerNumero(texto: string): number | null {
  const t = quitarAcentos(texto).toLowerCase();
  if (t === '½') return 0.5;
  if (t in NUMEROS_ESCRITOS) return NUMEROS_ESCRITOS[t];
  const fraccion = t.match(/^(\d+)\/(\d+)$/);
  if (fraccion) return Number(fraccion[2]) ? Number(fraccion[1]) / Number(fraccion[2]) : null;
  const n = parseFloat(t.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const NUM = String.raw`(\d+\/\d+|\d+(?:[.,]\d+)?|½)`;
const NUM_O_PALABRA = String.raw`(\d+\/\d+|\d+(?:[.,]\d+)?|½|(?:medio|media|una?|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce|quince|veinte)(?![a-záéíóúñ]))`;
const PALABRA = String.raw`([a-záéíóúñ]+\.?)`;

// "[27/9/26, 10:15] Ana: ..." o "27/9/26 10:15 - Ana: ..." (exportaciones de chat)
const PREFIJO_WHATSAPP =
  /^\[?\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?\s?m\.?)?\]?\s*(?:-\s*)?[^:]{1,40}:\s*/i;
const VINETA = /^(?:[-–—•*·▪►>+]+\s*|\d{1,2}[.)]\s+|\[\s?[xX✓ ]?\s?\]\s*)/;
const EMOJIS = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu;

function limpiarLinea(linea: string): string {
  let s = linea.replace(PREFIJO_WHATSAPP, '').replace(EMOJIS, ' ').trim();
  // Viñetas repetidas ("- 1. harina") y formato de WhatsApp (*negrita*, _cursiva_, ~tachado~).
  for (let i = 0; i < 3 && VINETA.test(s); i++) s = s.replace(VINETA, '');
  s = s.replace(/(^|\s)[*_~]+|[*_~]+(?=\s|$)/g, '$1');
  return s.replace(/\s+/g, ' ').trim();
}

function esLineaIgnorable(s: string): boolean {
  if (!s || !/[a-záéíóúñ]/i.test(s)) return true;
  if (/^<.*>$/.test(s)) return true; // <Multimedia omitido>
  if (/(omitido|eliminó este mensaje|mensaje eliminado|cifrados de extremo)/i.test(s)) return true;
  // Encabezados tipo "Lista para mañana:" o "COMPRAS:"
  if (/:\s*$/.test(s) && !new RegExp(NUM).test(s)) return true;
  return false;
}

function capitalizar(s: string): string {
  const limpio = s.replace(/^(?:de|del)\s+/i, '').replace(/[\s,;:.\-–]+$/, '').replace(/^[\s,;:\-–]+/, '').trim();
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

function extraerCantidad(s: string): { nombre: string; cantidad: number | null; unidad: string | null } {
  let m: RegExpMatchArray | null;

  // "harina x3", "aceite 1L x 2", "harina (3)", "huevos x 2 cartones"
  m = s.match(new RegExp(String.raw`^(.+?)(?:\s+[xX×*]\s*${NUM}|\s*\(\s*${NUM}\s*\))\s*${PALABRA}?$`, 'i'));
  if (m) {
    const unidad = unidadCanonica(m[4]);
    if (!m[4] || unidad) {
      return { nombre: m[1], cantidad: leerNumero(m[2] ?? m[3]), unidad };
    }
  }

  // "x3 harina"
  m = s.match(new RegExp(String.raw`^[xX×]\s*${NUM}\s+(.+)$`));
  if (m) return { nombre: m[2], cantidad: leerNumero(m[1]), unidad: null };

  // "2 kg de harina", "2kg harina", "3 cajas de leche", "10 huevos", "un kilo de queso"
  m = s.match(new RegExp(String.raw`^${NUM_O_PALABRA}\s*${PALABRA}?\s+(.+)$`, 'i'));
  if (m) {
    const cantidad = leerNumero(m[1]);
    const unidad = unidadCanonica(m[2]);
    const esPalabra = !/^[\d½]/.test(m[1]);
    if (cantidad != null && unidad) return { nombre: m[3], cantidad, unidad };
    // Sin unidad reconocida la palabra forma parte del nombre ("10 huevos").
    if (cantidad != null && !esPalabra) {
      return { nombre: m[2] ? `${m[2]} ${m[3]}` : m[3], cantidad, unidad: null };
    }
    if (cantidad != null && esPalabra && cantidad >= 2) {
      return { nombre: m[2] ? `${m[2]} ${m[3]}` : m[3], cantidad, unidad: null };
    }
  }
  // "10huevos" pegado
  m = s.match(/^(\d+(?:[.,]\d+)?)([a-záéíóúñ].*)$/i);
  if (m && !unidadCanonica(m[2].split(' ')[0])) {
    return { nombre: m[2], cantidad: leerNumero(m[1]), unidad: null };
  }

  // "harina 2kg", "Harina: 2 kg", "leche - 3 cajas", "queso 1/2 kilo"
  m = s.match(new RegExp(String.raw`^(.+?)\s*[:=\-–]?\s*${NUM}\s*${PALABRA}$`, 'i'));
  if (m && unidadCanonica(m[3])) {
    return { nombre: m[1], cantidad: leerNumero(m[2]), unidad: unidadCanonica(m[3]) };
  }

  // "Harina: 3", "Pan - 20"
  m = s.match(new RegExp(String.raw`^(.+?)\s*[:=\-–]\s*${NUM}$`));
  if (m) return { nombre: m[1], cantidad: leerNumero(m[2]), unidad: null };

  // "Tomate 3"
  m = s.match(/^(.+?)\s+(\d{1,3})$/);
  if (m) return { nombre: m[1], cantidad: leerNumero(m[2]), unidad: null };

  return { nombre: s, cantidad: null, unidad: null };
}

export function parseLinea(linea: string): ItemParseado | null {
  const limpio = limpiarLinea(linea);
  if (esLineaIgnorable(limpio)) return null;
  const { nombre, cantidad, unidad } = extraerCantidad(limpio);
  const nombreFinal = capitalizar(nombre);
  if (!nombreFinal || !/[a-záéíóúñ]/i.test(nombreFinal)) return null;
  return { nombre: nombreFinal, cantidad, unidad, original: linea.trim() };
}

/** Divide el mensaje por saltos de línea (y comas/punto y coma en una sola línea larga). */
export function parseLista(texto: string): ItemParseado[] {
  let lineas = texto.split(/\r?\n/);
  if (lineas.filter((l) => l.trim()).length === 1 && /[,;]/.test(texto)) {
    // "harina, azúcar, 2 kg de queso" en un solo mensaje. No se corta "1,5 kg".
    lineas = texto.split(/;|,(?!\d)/);
  }
  return lineas.map(parseLinea).filter((i): i is ItemParseado => i !== null);
}
