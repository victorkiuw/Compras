/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conIva, desglosarIva, sinIva, sugerirExento } from './iva.ts';

test('sugiere exentos de la canasta básica', () => {
  for (const p of ['Arroz', 'Harina PAN', 'Pasta larga', 'Azúcar', 'Sal', 'Café molido', 'Pollo entero', 'Carne molida', 'Huevos', 'Atún', 'Sardinas', 'Leche en polvo', 'Queso blanco duro', 'Aceite vegetal', 'Mayonesa', 'Salsa de tomate', 'Tomate', 'Cebolla', 'Plátano', 'Mortadela']) {
    assert.equal(sugerirExento(p), true, p);
  }
});

test('sugiere gravados los procesados y no alimentos', () => {
  for (const p of ['Aceite de oliva', 'Salsa inglesa', 'Jamón', 'Salchichas', 'Refresco', 'Queso amarillo', 'Galletas', 'Servilletas', 'Detergente', 'Papel higiénico', 'Salero', 'Panela de chocolate', 'Cloro']) {
    assert.equal(sugerirExento(p), false, p);
  }
});

test('desglose con base exenta y gravada al 16 %', () => {
  const d = desglosarIva([
    { base: 100, exento: false },
    { base: 50, exento: true },
  ]);
  assert.deepEqual(d, { base: 150, exento: 50, gravado: 100, iva: 16, total: 166 });
  assert.ok(Math.abs(conIva(100, 16) - 116) < 1e-9);
  assert.ok(Math.abs(sinIva(116, 16) - 100) < 1e-9);
});
