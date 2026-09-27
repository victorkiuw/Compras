/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularResumen, variacionesPorComercio, type CompraRegistrada } from './ahorro.ts';

const r = (comercio: string, id: number, usd: number | null, cantidad: number | null, fecha: string): CompraRegistrada => ({
  comercio_id: id,
  comercio_nombre: comercio,
  precio_unitario_usd: usd,
  cantidad,
  fecha,
});

test('ahorro y sobrecosto por comercio frente al promedio', () => {
  const res = calcularResumen([
    r('Makro', 1, 5, 2, '2026-09-01'),
    r('Makro', 1, 5.4, 2, '2026-09-10'),
    r('Hyperlider', 2, 6, 4, '2026-09-15'),
  ])!;
  // Gastado: 10 + 10,8 + 24 = 44,8 en 8 unidades → promedio 5,6
  assert.equal(res.gastadoUsd, 44.8);
  assert.equal(res.cantidad, 8);
  assert.ok(Math.abs(res.promedioUsd - 5.6) < 1e-9);
  const [makro, hyper] = res.porComercio;
  assert.equal(makro.nombre, 'Makro');
  assert.equal(makro.diferenciaUsd, 1.6); // (0,6×2) + (0,2×2)
  assert.equal(hyper.diferenciaUsd, -1.6); // (−0,4×4)
  assert.equal(makro.minimoUsd, 5);
  assert.equal(makro.maximoUsd, 5.4);
  assert.equal(makro.ultimoUsd, 5.4);
  // Promedio Makro 5,2: en Makro pagaste 0,2×2 de más la segunda vez, en Hyperlider 0,8×4.
  assert.equal(res.sobrecostoVsMejorUsd, 3.6);
  assert.deepEqual(res.minimo, { usd: 5, comercio: 'Makro', fecha: '2026-09-01' });
});

test('ignora registros sin precio en dólares y usa cantidad 1 si falta', () => {
  assert.equal(calcularResumen([r('A', 1, null, 2, '2026-01-01')]), null);
  const res = calcularResumen([r('A', 1, 3, null, '2026-01-01'), r('A', 1, null, 5, '2026-01-02')])!;
  assert.equal(res.compras, 1);
  assert.equal(res.cantidad, 1);
  assert.equal(res.sobrecostoVsMejorUsd, 0);
});

test('variación frente a la compra anterior en el mismo comercio', () => {
  const regs = [
    r('Makro', 1, 5.4, 1, '2026-09-10'),
    r('Makro', 1, 5, 1, '2026-09-01'),
    r('Hyper', 2, 6, 1, '2026-09-05'),
  ];
  const v = variacionesPorComercio(regs);
  assert.ok(Math.abs(v.get(0)! - 8) < 1e-9);
  assert.equal(v.has(1), false);
  assert.equal(v.has(2), false);
});
