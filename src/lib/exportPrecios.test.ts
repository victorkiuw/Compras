/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { hojasPrecios, resumirPrecios, type RegistroPrecio } from './exportPrecios.ts';
import { crearXlsx } from './xlsx.ts';

const r = (producto: string, comercio: string, usd: number | null, bs: number, fecha: string): RegistroPrecio => ({
  producto,
  unidad: 'Bulto',
  comercio,
  precio_unitario_usd: usd,
  precio_unitario_bs: bs,
  tasa_bs: 40,
  cantidad: 1,
  fecha,
});

const registros = [
  r('Harina', 'Makro', 15, 600, '2026-09-01'),
  r('Harina', 'Makro', 16, 640, '2026-09-20'),
  r('Harina', 'Hyperlider', 17, 680, '2026-09-10'),
  r('Aceite', 'Hyperlider', 20, 800, '2026-09-10'),
];

test('resume último, mínimo, máximo y promedio por negocio', () => {
  const makro = resumirPrecios(registros).find((x) => x.producto === 'Harina' && x.comercio === 'Makro')!;
  assert.equal(makro.ultimoUsd, 16);
  assert.equal(makro.minUsd, 15);
  assert.equal(makro.maxUsd, 16);
  assert.equal(makro.promUsd, 15.5);
  assert.equal(makro.compras, 2);
});

test('comparativa con un negocio por columna y el más barato', () => {
  const [comp, porNegocio, todos] = hojasPrecios(registros, new Date(2026, 9, 7));
  const plano = (c: unknown) => (c && typeof c === 'object' && 'v' in c ? (c as { v: unknown }).v : c);
  assert.deepEqual(comp.filas[3].map(plano), ['Producto', 'Unidad', 'Hyperlider', 'Makro', 'Más barato en', 'Mejor precio $', 'Diferencia %']);
  assert.deepEqual(comp.filas[4].map(plano), ['Aceite', 'Bulto', 20, null, 'Hyperlider', 20, null]);
  assert.deepEqual(comp.filas[5].map(plano), ['Harina', 'Bulto', 17, 16, 'Makro', 16, 6]);
  assert.equal(porNegocio.filas.length, 1 + 3);
  assert.deepEqual(todos.filas.slice(1).map((f) => [plano(f[0]), plano(f[1]), plano(f[3])]), [
    ['Aceite', 'Hyperlider', 20],
    ['Harina', 'Makro', 15],
    ['Harina', 'Makro', 16],
    ['Harina', 'Hyperlider', 17],
  ]);
  if (process.env.XLSX_PRECIOS) writeFileSync(process.env.XLSX_PRECIOS, crearXlsx([comp, porNegocio, todos]));
});
