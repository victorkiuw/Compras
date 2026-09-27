import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Boton, colores, estilos, Icono } from '../../components/ui';
import * as repo from '../../db/repo';
import type { Item, Lista } from '../../db/repo';
import { formatBs, formatCantidad, formatFechaHora } from '../../lib/format';

function agrupar(items: Item[], clave: (i: Item) => string | null) {
  const mapa = new Map<string, number>();
  for (const i of items) {
    if (!i.comprado) continue;
    const k = clave(i) ?? 'Sin dato';
    mapa.set(k, (mapa.get(k) ?? 0) + (i.precio_pagado_bs ?? 0));
  }
  return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
}

export default function DetalleCompra() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lista, setLista] = useState<Lista | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [fotoAbierta, setFotoAbierta] = useState<string | null>(null);

  useEffect(() => {
    const listaId = Number(id);
    repo.getLista(listaId).then(setLista);
    repo.getItems(listaId).then(setItems);
  }, [id]);

  const comprados = items.filter((i) => i.comprado);
  const noComprados = items.filter((i) => !i.comprado);
  const porMetodo = agrupar(items, (i) => i.metodo_pago);
  const porComercio = agrupar(items, (i) => i.comercio_nombre);
  const fotos = [...new Set(comprados.map((i) => i.foto_factura_uri).filter((f): f is string => !!f))];

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
          <Text style={s.totalEtiqueta}>Total gastado</Text>
          <Text style={s.totalMonto}>{formatBs(lista.total_gastado_bs)}</Text>
          <Text style={s.totalEtiqueta}>
            {comprados.length} de {items.length} productos comprados
          </Text>
        </View>

        <View style={s.dosColumnas}>
          <Desglose titulo="Por método de pago" filas={porMetodo} />
          <Desglose titulo="Por comercio" filas={porComercio} />
        </View>

        {fotos.length > 0 && (
          <View style={estilos.tarjeta}>
            <Text style={[estilos.etiqueta, { marginBottom: 8 }]}>Comprobantes</Text>
            <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
              {fotos.map((f) => (
                <Pressable key={f} onPress={() => setFotoAbierta(f)}>
                  <Image source={{ uri: f }} style={s.miniatura} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={estilos.tarjeta}>
          <Text style={[estilos.etiqueta, { marginBottom: 4 }]}>Productos</Text>
          {comprados.map((i) => (
            <View key={i.id} style={s.item}>
              <View style={{ flex: 1 }}>
                <Text style={s.nombre}>{i.producto_nombre}</Text>
                <Text style={s.meta}>
                  {formatCantidad(i.cantidad_comprada)}
                  {i.unidad ? ` ${i.unidad}` : ''} · {i.comercio_nombre} · {i.metodo_pago}
                </Text>
              </View>
              {i.foto_factura_uri && (
                <Pressable onPress={() => setFotoAbierta(i.foto_factura_uri)} hitSlop={10}>
                  <Icono name="receipt-outline" size={20} color={colores.acento} />
                </Pressable>
              )}
              <Text style={s.precio}>{formatBs(i.precio_pagado_bs)}</Text>
            </View>
          ))}
          {noComprados.map((i) => (
            <View key={i.id} style={s.item}>
              <Text style={[s.nombre, { flex: 1, color: colores.textoSuave, textDecorationLine: 'line-through' }]}>{i.producto_nombre}</Text>
              <Text style={s.meta}>No comprado</Text>
            </View>
          ))}
        </View>

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

function Desglose({ titulo, filas }: { titulo: string; filas: [string, number][] }) {
  return (
    <View style={[estilos.tarjeta, { flex: 1, gap: 6 }]}>
      <Text style={estilos.etiqueta}>{titulo}</Text>
      {filas.length === 0 && <Text style={s.meta}>—</Text>}
      {filas.map(([k, v]) => (
        <View key={k}>
          <Text style={s.meta}>{k}</Text>
          <Text style={s.desgloseMonto}>{formatBs(v)}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  total: { backgroundColor: colores.primario, borderColor: colores.primario, gap: 2 },
  totalEtiqueta: { color: '#D6F0E4', fontSize: 14 },
  totalMonto: { color: '#fff', fontSize: 28, fontWeight: '800' },
  dosColumnas: { flexDirection: 'row', gap: 12 },
  desgloseMonto: { fontSize: 16, fontWeight: '700', color: colores.texto },
  miniatura: { width: 90, height: 120, borderRadius: 8, backgroundColor: colores.borde },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colores.borde,
  },
  nombre: { fontSize: 16, fontWeight: '600', color: colores.texto },
  meta: { fontSize: 13, color: colores.textoSuave },
  precio: { fontSize: 15, fontWeight: '700', color: colores.texto },
  visor: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: 12 },
});
