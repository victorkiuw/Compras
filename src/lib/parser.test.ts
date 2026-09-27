/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarNombre, parseLinea, parseLista } from './parser.ts';

const caso = (linea: string) => {
  const r = parseLinea(linea);
  return r && { nombre: r.nombre, cantidad: r.cantidad, unidad: r.unidad };
};

test('cantidad y unidad al inicio', () => {
  assert.deepEqual(caso('2 kg de harina'), { nombre: 'Harina', cantidad: 2, unidad: 'Kg' });
  assert.deepEqual(caso('2kg harina'), { nombre: 'Harina', cantidad: 2, unidad: 'Kg' });
  assert.deepEqual(caso('3 cajas de leche'), { nombre: 'Leche', cantidad: 3, unidad: 'Caja' });
  assert.deepEqual(caso('1,5 kilos de queso blanco'), { nombre: 'Queso blanco', cantidad: 1.5, unidad: 'Kg' });
  assert.deepEqual(caso('1/2 kg jamón'), { nombre: 'Jamón', cantidad: 0.5, unidad: 'Kg' });
  assert.deepEqual(caso('un kilo de carne molida'), { nombre: 'Carne molida', cantidad: 1, unidad: 'Kg' });
  assert.deepEqual(caso('medio kilo de ajo'), { nombre: 'Ajo', cantidad: 0.5, unidad: 'Kg' });
});

test('cantidad sin unidad', () => {
  assert.deepEqual(caso('10 huevos'), { nombre: 'Huevos', cantidad: 10, unidad: null });
  assert.deepEqual(caso('dos pollos'), { nombre: 'Pollos', cantidad: 2, unidad: null });
  assert.deepEqual(caso('Harina x3'), { nombre: 'Harina', cantidad: 3, unidad: null });
  assert.deepEqual(caso('x3 harina'), { nombre: 'Harina', cantidad: 3, unidad: null });
  assert.deepEqual(caso('Harina PAN (4)'), { nombre: 'Harina PAN', cantidad: 4, unidad: null });
  assert.deepEqual(caso('Pan: 20'), { nombre: 'Pan', cantidad: 20, unidad: null });
  assert.deepEqual(caso('Tomate 3'), { nombre: 'Tomate', cantidad: 3, unidad: null });
});

test('cantidad y unidad al final', () => {
  assert.deepEqual(caso('Harina 2kg'), { nombre: 'Harina', cantidad: 2, unidad: 'Kg' });
  assert.deepEqual(caso('Leche - 3 cajas'), { nombre: 'Leche', cantidad: 3, unidad: 'Caja' });
  assert.deepEqual(caso('Aceite 1L x 2'), { nombre: 'Aceite 1L', cantidad: 2, unidad: null });
  assert.deepEqual(caso('Huevos x 2 cartones'), { nombre: 'Huevos', cantidad: 2, unidad: 'Cartón' });
});

test('sin cantidad y palabras que parecen números', () => {
  assert.deepEqual(caso('Servilletas'), { nombre: 'Servilletas', cantidad: null, unidad: null });
  assert.deepEqual(caso('Mix de frutos secos'), { nombre: 'Mix de frutos secos', cantidad: null, unidad: null });
  assert.deepEqual(caso('Unas servilletas'), { nombre: 'Unas servilletas', cantidad: null, unidad: null });
  assert.deepEqual(caso('Dosificador de salsa'), { nombre: 'Dosificador de salsa', cantidad: null, unidad: null });
});

test('limpia viñetas, emojis, formato y prefijos de WhatsApp', () => {
  assert.deepEqual(caso('- 2 kg azúcar'), { nombre: 'Azúcar', cantidad: 2, unidad: 'Kg' });
  assert.deepEqual(caso('• Café'), { nombre: 'Café', cantidad: null, unidad: null });
  assert.deepEqual(caso('1. Arroz x2'), { nombre: 'Arroz', cantidad: 2, unidad: null });
  assert.deepEqual(caso('3) *Mantequilla*'), { nombre: 'Mantequilla', cantidad: null, unidad: null });
  assert.deepEqual(caso('🥚 30 huevos ✅'), { nombre: 'Huevos', cantidad: 30, unidad: null });
  assert.deepEqual(caso('[27/9/26, 10:15] Jefe: 5 kg papas'), { nombre: 'Papas', cantidad: 5, unidad: 'Kg' });
  assert.deepEqual(caso('27/09/2026 10:15 p. m. - María: Cebolla 2kg'), { nombre: 'Cebolla', cantidad: 2, unidad: 'Kg' });
});

test('ignora encabezados y líneas vacías', () => {
  const items = parseLista(`Lista para mañana:

- 2 kg harina
<Multimedia omitido>
🛒🛒
- Queso 1 kg
`);
  assert.deepEqual(items.map((i) => i.nombre), ['Harina', 'Queso']);
});

test('lista en una sola línea separada por comas', () => {
  const items = parseLista('harina, azúcar, 1,5 kg de queso');
  assert.deepEqual(
    items.map((i) => [i.nombre, i.cantidad, i.unidad]),
    [['Harina', null, null], ['Azúcar', null, null], ['Queso', 1.5, 'Kg']],
  );
});

test('normalizarNombre', () => {
  assert.equal(normalizarNombre('  Azúcar  Refinada '), 'azucar refinada');
  assert.equal(normalizarNombre('Harina P.A.N.'), 'harina p a n');
});
