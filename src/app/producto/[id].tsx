import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colores, estilos, Icono, Vacio } from '../../components/ui';
import * as repo from '../../db/repo';
import type { RegistroHistorico } from '../../db/repo';
import { calcularResumen, variacionesPorComercio } from '../../lib/ahorro';
import { formatBs, formatCantidad, formatFecha, formatNumero, formatTasa, formatUsd, haceCuanto } from '../../lib/format';
import { useCompraStore } from '../../store/useCompraStore';

export default function DetalleProducto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tasa = useCompraStore((s) => s.tasaBs);
  const [producto, setProducto] = useState<{ nombre: string; unidad: string | null } | null>(null);
  const [registros, setRegistros] = useState<RegistroHistorico[]>([]);

  useEffect(() => {
    repo.getProducto(Number(id)).then(setProducto);
    repo.historialProducto(Number(id)).then(setRegistros);
  }, [id]);

  const resumen = useMemo(() => calcularResumen(registros), [registros]);
  const variaciones = useMemo(() => variacionesPorComercio(registros), [registros]);
  const unidad = producto?.unidad ? `/${producto.unidad}` : '';

  return (
    <>
      <Stack.Screen options={{ title: producto?.nombre ?? 'Producto' }} />
      <ScrollView contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 40 }}>
        {!resumen ? (
          <Vacio
            icono="pricetags-outline"
            titulo="Sin precios en dólares"
            texto="El cálculo de ahorro se hace en dólares. Registra compras con la tasa del día para verlo aquí."
          />
        ) : (
          <>
            {/* Resumen general */}
            <View style={[estilos.tarjeta, s.resumen]}>
              <Text style={s.resumenEtiqueta}>
                Gastado en {resumen.compras} {resumen.compras === 1 ? 'compra' : 'compras'} ({formatCantidad(resumen.cantidad)}
                {producto?.unidad ? ` ${producto.unidad}` : ' unid.'})
              </Text>
              <Text style={s.resumenTotal}>{formatUsd(resumen.gastadoUsd)}</Text>
              <View style={s.fila3}>
                <Dato etiqueta="Promedio" valor={`${formatUsd(resumen.promedioUsd)}${unidad}`} />
                <Dato etiqueta="Más barato" valor={formatUsd(resumen.minimo.usd)} sub={resumen.minimo.comercio} />
                <Dato etiqueta="Más caro" valor={formatUsd(resumen.maximo.usd)} sub={resumen.maximo.comercio} />
              </View>
              {tasa ? <Text style={s.resumenEtiqueta}>Al promedio, hoy pagarías {formatBs(resumen.promedioUsd * tasa)}{unidad}</Text> : null}
            </View>

            {resumen.sobrecostoVsMejorUsd > 0.009 && (
              <View style={[estilos.tarjeta, s.aviso]}>
                <Icono name="bulb-outline" color={colores.aviso} />
                <Text style={s.avisoTexto}>
                  Si todo lo hubieras comprado en {resumen.porComercio[0].nombre} (a su precio promedio), habrías gastado{' '}
                  <Text style={{ fontWeight: '800' }}>{formatUsd(resumen.sobrecostoVsMejorUsd)}</Text> menos
                  {tasa ? ` (≈ ${formatBs(resumen.sobrecostoVsMejorUsd * tasa)} hoy)` : ''}.
                </Text>
              </View>
            )}

            {/* Ahorro por comercio */}
            <View style={[estilos.tarjeta, { gap: 10 }]}>
              <Text style={estilos.etiqueta}>Ahorro por comercio</Text>
              <Text style={s.explicacion}>
                Comparado con tu precio promedio del producto ({formatUsd(resumen.promedioUsd)}
                {unidad}).
              </Text>
              {resumen.porComercio.map((c, i) => {
                const ahorro = c.diferenciaUsd;
                const color = ahorro > 0.009 ? colores.primario : ahorro < -0.009 ? colores.peligro : colores.textoSuave;
                return (
                  <View key={c.comercioId} style={[s.comercioFila, i === 0 && resumen.porComercio.length > 1 && s.mejor]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={s.comercio}>{c.nombre}</Text>
                      <Text style={s.meta}>
                        {c.compras} {c.compras === 1 ? 'compra' : 'compras'} · promedio {formatUsd(c.promedioUsd)}
                        {c.minimoUsd !== c.maximoUsd ? ` · entre ${formatUsd(c.minimoUsd)} y ${formatUsd(c.maximoUsd)}` : ''}
                      </Text>
                      <Text style={s.meta}>
                        Último: {formatUsd(c.ultimoUsd)} · {haceCuanto(c.ultimaFecha)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[s.diferencia, { color }]}>
                        {ahorro > 0.009 ? '−' : ahorro < -0.009 ? '+' : ''}
                        {formatUsd(Math.abs(ahorro))}
                      </Text>
                      <Text style={[s.meta, { color }]}>
                        {ahorro > 0.009 ? 'ahorrado' : ahorro < -0.009 ? 'pagado de más' : 'en el promedio'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Historial de compras con variación */}
        {registros.length > 0 && (
          <View style={[estilos.tarjeta, { gap: 2 }]}>
            <Text style={[estilos.etiqueta, { marginBottom: 6 }]}>Todas las compras</Text>
            {registros.map((r, idx) => {
              const v = variaciones.get(idx);
              return (
                <View key={r.id} style={s.registro}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.registroTitulo}>
                      {formatFecha(r.fecha)} · {r.comercio_nombre}
                    </Text>
                    <Text style={s.meta}>
                      {r.cantidad != null ? `${formatCantidad(r.cantidad)} × ` : ''}
                      {formatBs(r.precio_unitario_bs)}
                      {r.tasa_bs ? ` · ${formatTasa(r.tasa_bs)}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.registroPrecio}>
                      {r.precio_unitario_usd != null ? formatUsd(r.precio_unitario_usd) : formatBs(r.precio_unitario_bs)}
                    </Text>
                    {v != null && Math.abs(v) >= 0.5 && (
                      <Text style={[s.meta, { color: v > 0 ? colores.peligro : colores.primario, fontWeight: '600' }]}>
                        {v > 0 ? '▲ +' : '▼ '}
                        {formatNumero(v, 1)}%
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
            <Text style={[s.explicacion, { marginTop: 6 }]}>▲▼ = cambio frente a la compra anterior en el mismo comercio.</Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}

function Dato({ etiqueta, valor, sub }: { etiqueta: string; valor: string; sub?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.resumenEtiqueta}>{etiqueta}</Text>
      <Text style={s.datoValor}>{valor}</Text>
      {sub && (
        <Text style={s.resumenEtiqueta} numberOfLines={1}>
          {sub}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  resumen: { backgroundColor: colores.primario, borderColor: colores.primario, gap: 6 },
  resumenEtiqueta: { color: '#D6F0E4', fontSize: 13 },
  resumenTotal: { color: '#fff', fontSize: 28, fontWeight: '800' },
  fila3: { flexDirection: 'row', gap: 8, marginTop: 4 },
  datoValor: { color: '#fff', fontSize: 17, fontWeight: '700' },
  aviso: { flexDirection: 'row', gap: 10, backgroundColor: colores.avisoSuave, borderColor: colores.avisoSuave },
  avisoTexto: { flex: 1, fontSize: 15, color: colores.texto, lineHeight: 21 },
  explicacion: { fontSize: 13, color: colores.textoSuave },
  comercioFila: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, backgroundColor: colores.fondo },
  mejor: { backgroundColor: colores.primarioSuave },
  comercio: { fontSize: 16, fontWeight: '700', color: colores.texto },
  meta: { fontSize: 13, color: colores.textoSuave },
  diferencia: { fontSize: 18, fontWeight: '800' },
  registro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colores.borde,
  },
  registroTitulo: { fontSize: 15, fontWeight: '600', color: colores.texto, textTransform: 'capitalize' },
  registroPrecio: { fontSize: 16, fontWeight: '700', color: colores.texto },
});
