/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLista } from './parser.ts';
import { diasParaVencer, textoDeudas, textoLista, textoResumen, type ItemResumen } from './resumen.ts';

const item = (p: Partial<ItemResumen> & { producto_nombre: string }): ItemResumen => ({
  cantidad_pedida: null,
  cantidad_comprada: null,
  unidad: null,
  precio_pagado_bs: null,
  precio_pagado_usd: null,
  comprado: 0,
  no_disponible: 0,
  factura_id: null,
  nota: null,
  ...p,
});

test('resumen separa pagado, crédito, no había y pendientes', () => {
  const texto = textoResumen(
    new Date(2026, 8, 27, 10).toISOString(),
    [
      item({ producto_nombre: 'Harina', comprado: 1, factura_id: 1, cantidad_comprada: 2, unidad: 'Bulto', precio_pagado_usd: 30, precio_pagado_bs: 1095 }),
      item({ producto_nombre: 'Aceite', comprado: 1, factura_id: 2, cantidad_comprada: 1, unidad: 'Caja', precio_pagado_usd: 40, precio_pagado_bs: 1460 }),
      item({ producto_nombre: 'Queso', no_disponible: 1, cantidad_pedida: 2, unidad: 'Kg' }),
      item({ producto_nombre: 'Servilletas' }),
    ],
    [
      { id: 1, comercio_nombre: 'Makro', metodo_pago: 'Tarjeta', tasa_bs: 36.5, total_bs: 1095, total_usd: 30, vence: null },
      { id: 2, comercio_nombre: 'Hyperlider', metodo_pago: 'Crédito', tasa_bs: 36.5, total_bs: 1460, total_usd: 40, vence: null },
    ],
  );
  assert.match(texto, /\*Compra del dom 27\/09\/2026\*/);
  assert.match(texto, /Comprado: 2 de 4 productos/);
  assert.match(texto, /Pagado: Bs\. 1\.095,00 \(\$30,00\)/);
  assert.match(texto, /A crédito: \$40,00 \(Hyperlider\)/);
  assert.match(texto, /• Harina — 2 Bulto — \$30,00 \/ Bs\. 1\.095,00/);
  assert.match(texto, /vence sin fecha/);
  assert.match(texto, /No había:\*\n• Queso \(2 Kg\)/);
  assert.match(texto, /Sin comprar:\*\n• Servilletas/);
});

test('textoLista se vuelve a leer igual con el parser', () => {
  const texto = textoLista([
    { producto_nombre: 'Harina PAN', cantidad_pedida: 2, unidad: 'Bulto' },
    { producto_nombre: 'Queso blanco', cantidad_pedida: 1.5, unidad: 'Kg' },
    { producto_nombre: 'Servilletas', cantidad_pedida: null, unidad: null },
    { producto_nombre: 'Huevos', cantidad_pedida: 30, unidad: null },
  ]);
  assert.deepEqual(
    parseLista(texto).map((i) => [i.nombre, i.cantidad, i.unidad]),
    [
      ['Harina PAN', 2, 'Bulto'],
      ['Queso blanco', 1.5, 'Kg'],
      ['Servilletas', null, null],
      ['Huevos', 30, null],
    ],
  );
});

test('deudas agrupadas por comercio con vencimientos', () => {
  const ahora = new Date(2026, 8, 30, 12);
  const texto = textoDeudas(
    [
      { comercio_nombre: 'Makro', fecha: new Date(2026, 8, 20).toISOString(), vence: new Date(2026, 8, 27).toISOString(), total_usd: 100, saldo_usd: 60, productos: 'Harina, Aceite' },
      { comercio_nombre: 'Makro', fecha: new Date(2026, 8, 29).toISOString(), vence: null, total_usd: 20, saldo_usd: 20, productos: null },
      { comercio_nombre: 'Hyperlider', fecha: new Date(2026, 8, 29).toISOString(), vence: new Date(2026, 9, 2).toISOString(), total_usd: 15, saldo_usd: 15, productos: null },
    ],
    40,
    ahora,
  );
  assert.match(texto, /Total: \$95,00 \(≈ Bs\. 3\.800,00 a 40,00 Bs\/\$\)/);
  assert.match(texto, /\*Makro\* · \$80,00/);
  assert.match(texto, /\$60,00 \(de \$100,00, abonado \$40,00\) — VENCIDA hace 3 días/);
  assert.match(texto, /sin fecha de vencimiento/);
  assert.match(texto, /\*Hyperlider\* · \$15,00\n• .* — vence en 2 días/);
});

test('diasParaVencer', () => {
  const ahora = new Date(2026, 8, 30, 23);
  assert.equal(diasParaVencer(new Date(2026, 8, 30, 1).toISOString(), ahora), 0);
  assert.equal(diasParaVencer(new Date(2026, 9, 1).toISOString(), ahora), 1);
  assert.equal(diasParaVencer(null, ahora), null);
});
