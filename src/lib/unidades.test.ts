/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cantidadDePrecio, nombreUnidadPrecio, pasoDeCantidad, unidadDePrecio } from './unidades.ts';

test('gramos y ml se cotizan por kilo y litro', () => {
  assert.equal(cantidadDePrecio(500, 'g'), 0.5);
  assert.equal(cantidadDePrecio(250, 'ml'), 0.25);
  assert.equal(cantidadDePrecio(2, 'Kg'), 2);
  assert.equal(cantidadDePrecio(3, null), 3);
  assert.equal(nombreUnidadPrecio('g'), 'Kg');
  assert.equal(nombreUnidadPrecio('Caja'), 'Caja');
  assert.equal(unidadDePrecio('Unidad'), null);
  assert.equal(pasoDeCantidad('g'), 50);
  assert.equal(pasoDeCantidad('Kg'), 1);
});

test('el precio del kilo da el total de los gramos', () => {
  // 500 g de un producto a Bs. 5.422,76 el kilo cuestan la mitad.
  const precioKg = 5422.76;
  assert.ok(Math.abs(precioKg * cantidadDePrecio(500, 'g') - 2711.38) < 1e-9);
});
