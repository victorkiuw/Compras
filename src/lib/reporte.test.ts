/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';
import { hojasReporte, inicioSemana, rangoSemana, resumirSemana, type EntradaReporte } from './reporte.ts';
import { crearXlsx } from './xlsx.ts';

const entrada: EntradaReporte = {
  compras: [
    { factura_id: 1, fecha: '2026-09-28T14:00:00Z', comercio: 'Makro', metodo_pago: 'Tarjeta', tasa_bs: 40, producto: 'Harina', cantidad: 2, unidad: 'Bulto', total_usd: 30, total_bs: 1200 },
    { factura_id: 1, fecha: '2026-09-28T14:00:00Z', comercio: 'Makro', metodo_pago: 'Tarjeta', tasa_bs: 40, producto: 'Aceite', cantidad: 1, unidad: 'Caja', total_usd: 20, total_bs: 800 },
    { factura_id: 2, fecha: '2026-09-29T14:00:00Z', comercio: 'Hyperlider', metodo_pago: 'Crédito', tasa_bs: 40, producto: 'Harina', cantidad: 1, unidad: 'Bulto', total_usd: 16, total_bs: 640 },
  ],
  noHabia: [{ fecha: '2026-09-28T10:00:00Z', producto: 'Queso <blanco> & "duro"', cantidad: 2, unidad: 'Kg' }],
  abonos: [{ fecha: '2026-09-30T10:00:00Z', comercio: 'Hyperlider', monto_usd: 6, nota: null }],
  creditosPendientes: [
    { comercio_nombre: 'Hyperlider', fecha: '2026-09-29T14:00:00Z', vence: null, total_usd: 16, abonado_usd: 6, saldo_usd: 10, productos: 'Harina' },
  ],
};

test('resumen de la semana separa pagado y crédito', () => {
  const r = resumirSemana(entrada);
  assert.equal(r.pagadoUsd, 50);
  assert.equal(r.pagadoBs, 2000);
  assert.equal(r.creditoUsd, 16);
  assert.equal(r.facturas, 2);
  const harina = r.porProducto.find((p) => p.producto === 'Harina')!;
  assert.equal(harina.cantidad, 3);
  assert.equal(harina.mejorComercio, 'Makro');
  assert.equal(harina.mejorUsd, 15);
  assert.deepEqual(r.porComercio.map((c) => [c.comercio, c.usd, c.creditoUsd]), [['Makro', 50, 0], ['Hyperlider', 0, 16]]);
});

test('semana de lunes a domingo', () => {
  const lunes = inicioSemana(new Date(2026, 8, 30)); // miércoles 30/09
  assert.equal(lunes.getDay(), 1);
  assert.equal(lunes.getDate(), 28);
  assert.equal(inicioSemana(new Date(2026, 9, 4)).getDate(), 28); // domingo 04/10 → misma semana
  assert.equal(rangoSemana(lunes).titulo, '28/09/2026 al 04/10/2026');
});

test('genera un xlsx válido con 5 hojas', () => {
  const bytes = crearXlsx(hojasReporte(entrada, '28/09/2026 al 04/10/2026'));
  const zip = unzipSync(bytes);
  assert.ok(zip['xl/workbook.xml']);
  assert.match(strFromU8(zip['xl/workbook.xml']), /name="Resumen".*name="Compras".*name="Productos".*name="Créditos".*name="No había"/s);
  assert.match(strFromU8(zip['xl/worksheets/sheet5.xml']), /Queso &lt;blanco&gt; &amp; &quot;duro&quot;/);
  if (process.env.XLSX_SALIDA) writeFileSync(process.env.XLSX_SALIDA, bytes);
});
