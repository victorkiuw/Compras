/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertir, formatBs, formatCantidad, formatUsd, haceCuanto, parseMonto } from './format.ts';

test('formatBs usa formato venezolano', () => {
  assert.equal(formatBs(1234.5), 'Bs. 1.234,50');
  assert.equal(formatBs(0), 'Bs. 0,00');
  assert.equal(formatBs(1_000_000), 'Bs. 1.000.000,00');
});

test('formatCantidad', () => {
  assert.equal(formatCantidad(2), '2');
  assert.equal(formatCantidad(1.5), '1,5');
  assert.equal(formatCantidad(0.25), '0,25');
});

test('parseMonto acepta varios formatos', () => {
  assert.equal(parseMonto('1.234,56'), 1234.56);
  assert.equal(parseMonto('1234,56'), 1234.56);
  assert.equal(parseMonto('1234.56'), 1234.56);
  assert.equal(parseMonto('1,234.56'), 1234.56);
  assert.equal(parseMonto('1.500'), 1500);
  assert.equal(parseMonto('45'), 45);
  assert.equal(parseMonto('Bs. 80,5'), 80.5);
  assert.equal(parseMonto('0,5'), 0.5);
  assert.equal(parseMonto(''), null);
  assert.equal(parseMonto('abc'), null);
});

test('haceCuanto', () => {
  const ahora = new Date(2026, 8, 27, 12);
  assert.equal(haceCuanto(new Date(2026, 8, 27, 8).toISOString(), ahora), 'hoy');
  assert.equal(haceCuanto(new Date(2026, 8, 26, 20).toISOString(), ahora), 'ayer');
  assert.equal(haceCuanto(new Date(2026, 8, 20).toISOString(), ahora), 'hace 7 días');
});

test('formatUsd y convertir con la tasa', () => {
  assert.equal(formatUsd(5.4), '$5,40');
  assert.deepEqual(convertir(5, 'USD', 36.5), { usd: 5, bs: 182.5 });
  assert.deepEqual(convertir(182.5, 'BS', 36.5), { usd: 5, bs: 182.5 });
  assert.deepEqual(convertir(5, 'USD', null), { usd: 5, bs: null });
});
