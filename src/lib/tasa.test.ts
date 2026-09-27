/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extraerTasa, obtenerTasa } from './tasa.ts';

test('objeto único de un endpoint específico', () => {
  const r = extraerTasa(
    { fuente: 'oficial', nombre: 'Oficial', compra: null, venta: null, promedio: 36.53, fechaActualizacion: '2026-09-27T12:00:00.000Z' },
    'oficial',
  );
  assert.deepEqual(r, { tasa: 36.53, fecha: '2026-09-27T12:00:00.000Z' });
});

test('lista con oficial y paralelo elige el pedido', () => {
  const json = [
    { fuente: 'oficial', nombre: 'Oficial', promedio: 36.5, fechaActualizacion: '2026-09-27T12:00:00Z' },
    { fuente: 'paralelo', nombre: 'Paralelo', promedio: 41.2, fechaActualizacion: '2026-09-27T13:00:00Z' },
  ];
  assert.equal(extraerTasa(json, 'oficial')?.tasa, 36.5);
  assert.equal(extraerTasa(json, 'paralelo')?.tasa, 41.2);
});

test('objetos anidados por clave y precios como texto', () => {
  const json = { datetime: { date: 'x' }, monitors: { bcv: { title: 'BCV', price: '36,50', last_update: '2026-09-27' }, enparalelovzla: { price: 41 } } };
  assert.equal(extraerTasa(json, 'oficial')?.tasa, 36.5);
  assert.equal(extraerTasa(json, 'paralelo')?.tasa, 41);
});

test('descarta respuestas sin cifra válida o del otro tipo', () => {
  assert.equal(extraerTasa({ error: 'not found' }, 'oficial'), null);
  assert.equal(extraerTasa({ promedio: 0 }, 'oficial'), null);
  assert.equal(extraerTasa({ fuente: 'paralelo', promedio: 41 }, 'oficial'), null);
});

test('obtenerTasa pasa a la siguiente fuente si una falla', async () => {
  const pedidas: string[] = [];
  const r = await obtenerTasa('oficial', async (url) => {
    pedidas.push(url);
    if (pedidas.length === 1) throw new Error('sin red');
    return { ok: true, json: async () => [{ fuente: 'oficial', promedio: 36.5 }] };
  });
  assert.equal(pedidas.length, 2);
  assert.deepEqual(r, { tasa: 36.5, fecha: null, fuente: 'DolarApi' });
});

test('obtenerTasa devuelve null sin conexión', async () => {
  const r = await obtenerTasa('oficial', async () => {
    throw new Error('offline');
  });
  assert.equal(r, null);
});
