/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agruparPorSeccion, iconoSeccion, seccionesDisponibles } from './secciones.ts';

test('agrupa comercios por sección en orden y por nombre', () => {
  const grupos = agruparPorSeccion([
    { nombre: 'Toro Bravo', tipo: 'Carnicería' },
    { nombre: 'Makro', tipo: 'Mayorista' },
    { nombre: 'Hyperlider', tipo: 'Supermercado' },
    { nombre: 'Central Madeirense', tipo: 'Supermercado' },
    { nombre: 'Insumos Pepe', tipo: 'Empaques' },
    { nombre: 'Locatel', tipo: 'Farmacia' },
  ]);
  assert.deepEqual(
    grupos.map((g) => [g.seccion, g.comercios.map((c) => c.nombre)]),
    [
      ['Supermercado', ['Central Madeirense', 'Hyperlider']],
      ['Mayorista', ['Makro']],
      ['Carnicería', ['Toro Bravo']],
      ['Farmacia', ['Locatel']],
      ['Empaques', ['Insumos Pepe']],
    ],
  );
});

test('secciones propias se suman a las predefinidas', () => {
  const s = seccionesDisponibles(['Supermercado', 'Empaques', 'Empaques', 'Agropecuaria']);
  assert.equal(s[0], 'Supermercado');
  assert.deepEqual(s.slice(-2), ['Agropecuaria', 'Empaques']);
  assert.equal(iconoSeccion('Farmacia'), 'medkit-outline');
  assert.equal(iconoSeccion('Empaques'), 'pricetag-outline');
});
