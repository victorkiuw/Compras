import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Boton, colores, estilos, Icono } from '../../components/ui';
import * as repo from '../../db/repo';
import type { Factura, Item, Lista } from '../../db/repo';
import { formatBs, formatCantidad, formatFechaHora, formatTasa, formatUsd } from '../../lib/format';

function agrupar(facturas: Factura[], clave: (f: Factura) => string | null) {
  const mapa = new Map<string, { bs: number; usd: number }>();
  for (const f of facturas) {
    const k = clave(f) ?? 'Sin dato';
    const actual = mapa.get(k) ?? { bs: 0, usd: 0 };
    mapa.set(k, { bs: actual.bs + f.total_bs, usd: actual.usd + (f.total_usd ?? 0) });
  }
  return [...mapa.entries()].sort((a, b) => b[1].bs - a[1].bs);
}

export default function DetalleCompra() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lista, setLista] = useState<Lista | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [fotoAbierta, setFotoAbierta] = useState<string | null>(null);

  useEffect(() => {
    const listaId = Number(id);
    repo.getLista(listaId).then(setLista);
    repo.getItems(listaId).then(setItems);
    repo.getFacturas(listaId).then(setFacturas);
  }, [id]);

  const comprados = items.filter((i) => i.comprado);
  const noComprados = items.filter((i) => !i.comprado);
  const porMetodo = agrupar(facturas, (f) => f.metodo_pago);
  const porComercio = agrupar(facturas, (f) => f.comercio_nombre);

  const eliminar = () =>
    Alert.alert('Eliminar compra', 'Se borrará este viaje de compra. Los precios registrados se mantienen en el radar.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await repo.eliminarLista(Number(id));
          router.back();
        },
      },
    ]);

  if (!lista) return null;

  return (
    <>
      <Stack.Screen options={{ title: formatFechaHora(lista.fecha) }} />
      <ScrollView contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 40 }}>
        <View style={[estilos.tarjeta, s.total]}>
          <Text style={s.totalEtiqueta}>Total pagado</Text>
          <Text style={s.totalMonto}>{formatBs(lista.total_gastado_bs)}</Text>
          {lista.total_gastado_usd ? <Text style={s.totalUsd}>{formatUsd(lista.total_gastado_usd)}</Text> : null}
          <Text style={s.totalEtiqueta}>
            {comprados.length} de {items.length} productos · {facturas.length} {facturas.length === 1 ? 'factura' : 'facturas'}
          </Text>
        </View>

        <View style={s.dosColumnas}>
          <Desglose titulo="Por método de pago" filas={porMetodo} />
          <Desglose titulo="Por comercio" filas={porComercio} />
        </View>

        {facturas.map((f) => (
          <View key={f.id} style={[estilos.tarjeta, { gap: 6 }]}>
            <View style={s.filaEntre}>
              <View style={{ flex: 1 }}>
                <Text style={s.facturaTitulo}>{f.comercio_nombre ?? 'Sin comercio'}</Text>
                <Text style={s.meta}>
                  {f.metodo_pago}
                  {f.tasa_bs ? ` · ${formatTasa(f.tasa_bs)}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.precio}>{formatBs(f.total_bs)}</Text>
                {f.total_usd != null && <Text style={s.meta}>{formatUsd(f.total_usd)}</Text>}
              </View>
              {f.foto_uri && (
                <Pressable onPress={() => setFotoAbierta(f.foto_uri)}>
                  <Image source={{ uri: f.foto_uri }} style={s.miniatura} />
                </Pressable>
              )}
            </View>
            {items
              .filter((i) => i.factura_id === f.id)
              .map((i) => (
                <View key={i.id} style={s.item}>
                  <Text style={s.nombre} numberOfLines={1}>
                    {i.producto_nombre}
                  </Text>
                  <Text style={s.meta}>
                    {formatCantidad(i.cantidad_comprada)}
                    {i.unidad ? ` ${i.unidad}` : ''}
                  </Text>
                  <Text style={s.itemPrecio}>{i.precio_pagado_usd != null ? formatUsd(i.precio_pagado_usd) : formatBs(i.precio_pagado_bs)}</Text>
                </View>
              ))}
          </View>
        ))}

        {noComprados.length > 0 && (
          <View style={estilos.tarjeta}>
            <Text style={[estilos.etiqueta, { marginBottom: 4 }]}>No comprados</Text>
            {noComprados.map((i) => (
              <Text key={i.id} style={[s.nombre, { color: colores.textoSuave, paddingVertical: 4 }]}>
                {i.producto_nombre}
              </Text>
            ))}
          </View>
        )}

        <Boton titulo="Eliminar esta compra" variante="texto" icono="trash-outline" onPress={eliminar} />
      </ScrollView>

      <Modal visible={!!fotoAbierta} transparent animationType="fade" onRequestClose={() => setFotoAbierta(null)}>
        <Pressable style={s.visor} onPress={() => setFotoAbierta(null)}>
          {fotoAbierta && <Image source={{ uri: fotoAbierta }} style={{ width: '100%', height: '85%' }} resizeMode="contain" />}
          <Text style={{ color: '#fff', marginTop: 12 }}>Toca para cerrar</Text>
        </Pressable>
      </Modal>
    </>
  );
}

function Desglose({ titulo, filas }: { titulo: string; filas: [string, { bs: number; usd: number }][] }) {
  return (
    <View style={[estilos.tarjeta, { flex: 1, gap: 6 }]}>
      <Text style={estilos.etiqueta}>{titulo}</Text>
      {filas.length === 0 && <Text style={s.meta}>—</Text>}
      {filas.map(([k, v]) => (
        <View key={k}>
          <Text style={s.meta}>{k}</Text>
          <Text style={s.desgloseMonto}>{formatBs(v.bs)}</Text>
          {v.usd > 0 && <Text style={s.meta}>{formatUsd(v.usd)}</Text>}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  total: { backgroundColor: colores.primario, borderColor: colores.primario, gap: 2 },
  totalEtiqueta: { color: '#D6F0E4', fontSize: 14 },
  totalMonto: { color: '#fff', fontSize: 28, fontWeight: '800' },
  totalUsd: { color: '#fff', fontSize: 17, fontWeight: '600' },
  dosColumnas: { flexDirection: 'row', gap: 12 },
  desgloseMonto: { fontSize: 16, fontWeight: '700', color: colores.texto },
  filaEntre: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  facturaTitulo: { fontSize: 17, fontWeight: '700', color: colores.texto },
  miniatura: { width: 48, height: 64, borderRadius: 6, backgroundColor: colores.borde },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colores.borde,
  },
  nombre: { flex: 1, fontSize: 15, fontWeight: '500', color: colores.texto },
  meta: { fontSize: 13, color: colores.textoSuave },
  precio: { fontSize: 16, fontWeight: '700', color: colores.primario },
  itemPrecio: { fontSize: 15, fontWeight: '600', color: colores.texto, minWidth: 64, textAlign: 'right' },
  visor: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: 12 },
});
