import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RegistroSheet } from '../../components/RegistroSheet';
import { Boton, colores, estilos, Icono, Segmentado, Vacio } from '../../components/ui';
import * as repo from '../../db/repo';
import type { Item, ReferenciaPrecio } from '../../db/repo';
import { formatBs, formatCantidad, formatFecha, haceCuanto } from '../../lib/format';
import { parseLinea } from '../../lib/parser';
import { totalGastado, useCompraStore } from '../../store/useCompraStore';

type Pestana = 'pendientes' | 'comprados';

export default function ModoCompra() {
  const insets = useSafeAreaInsets();
  const { lista, items, referencias, recargar, eliminarItem, cerrar } = useCompraStore();
  const [pestana, setPestana] = useState<Pestana>('pendientes');
  const [seleccionado, setSeleccionado] = useState<Item | null>(null);
  const [nuevoTexto, setNuevoTexto] = useState('');

  useFocusEffect(
    useCallback(() => {
      recargar();
    }, [recargar]),
  );

  const pendientes = useMemo(() => items.filter((i) => !i.comprado), [items]);
  const comprados = useMemo(
    () => items.filter((i) => i.comprado).sort((a, b) => (b.comprado_en ?? '').localeCompare(a.comprado_en ?? '')),
    [items],
  );
  const total = totalGastado(items);
  const ultimaFoto = comprados.find((i) => i.foto_factura_uri)?.foto_factura_uri ?? null;
  const progreso = items.length ? comprados.length / items.length : 0;

  const agregarRapido = async () => {
    const parseado = parseLinea(nuevoTexto);
    if (!parseado) return;
    if (lista) await repo.agregarItems(lista.id, [parseado]);
    else await repo.importarItems([parseado], 'nueva');
    setNuevoTexto('');
    await recargar();
  };

  const opcionesItem = (item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert(item.producto_nombre, item.texto_original ?? undefined, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar de la lista',
        style: 'destructive',
        onPress: () => eliminarItem(item.id),
      },
    ]);
  };

  const cerrarCompra = () => {
    const botones: Parameters<typeof Alert.alert>[2] = [{ text: 'Cancelar', style: 'cancel' }];
    if (pendientes.length) {
      botones.push({ text: `Cerrar y pasar ${pendientes.length} pendientes a una lista nueva`, onPress: () => cerrar(true) });
      botones.push({ text: 'Cerrar sin pasar pendientes', style: 'destructive', onPress: () => cerrar(false) });
    } else {
      botones.push({ text: 'Cerrar compra', onPress: () => cerrar(false) });
    }
    Alert.alert('Cerrar compra', `Total gastado: ${formatBs(total)}\n${comprados.length} de ${items.length} productos comprados.`, botones);
  };

  const datos = pestana === 'pendientes' ? pendientes : comprados;

  return (
    <View style={[s.pantalla, { paddingTop: insets.top }]}>
      {/* Encabezado: fecha, progreso y total */}
      <View style={s.encabezado}>
        <View style={s.filaEntre}>
          <View>
            <Text style={s.fecha}>{lista ? formatFecha(lista.fecha) : formatFecha(new Date().toISOString())}</Text>
            <Text style={s.progresoTexto}>
              {comprados.length}/{items.length} productos
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.totalEtiqueta}>Gastado</Text>
            <Text style={s.total}>{formatBs(total)}</Text>
          </View>
        </View>
        <View style={s.barra}>
          <View style={[s.barraRelleno, { width: `${progreso * 100}%` }]} />
        </View>
        {lista && (
          <Segmentado
            opciones={[
              { valor: 'pendientes', etiqueta: `Pendientes (${pendientes.length})` },
              { valor: 'comprados', etiqueta: `Comprados (${comprados.length})` },
            ]}
            valor={pestana}
            onCambio={setPestana}
          />
        )}
      </View>

      {!lista ? (
        <Vacio icono="cart-outline" titulo="No hay compra activa" texto="Copia la lista que te mandaron por WhatsApp y pégala aquí para empezar.">
          <Boton titulo="Pegar lista de WhatsApp" icono="clipboard-outline" onPress={() => router.push('/importar')} />
        </Vacio>
      ) : (
        <FlatList
          data={datos}
          keyExtractor={(i) => String(i.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 120 }}
          renderItem={({ item }) => (
            <FilaItem
              item={item}
              referencia={referencias.get(item.producto_id)}
              onPress={() => setSeleccionado(item)}
              onLongPress={() => opcionesItem(item)}
            />
          )}
          ListEmptyComponent={
            pestana === 'pendientes' ? (
              <Vacio icono="checkmark-done-circle-outline" titulo="¡Todo comprado!" texto={`Total: ${formatBs(total)}`}>
                <Boton titulo="Cerrar compra" icono="lock-closed-outline" onPress={cerrarCompra} />
              </Vacio>
            ) : (
              <Vacio icono="basket-outline" titulo="Aún no has marcado productos" texto="Toca un producto pendiente para registrarlo." />
            )
          }
          ListFooterComponent={
            <View style={{ gap: 12, marginTop: 8 }}>
              {pestana === 'pendientes' && (
                <View style={s.agregar}>
                  <Icono name="add-circle-outline" color={colores.textoSuave} />
                  <TextInput
                    style={s.agregarInput}
                    placeholder="Agregar producto (ej. 2 kg de queso)"
                    placeholderTextColor={colores.textoSuave}
                    value={nuevoTexto}
                    onChangeText={setNuevoTexto}
                    onSubmitEditing={agregarRapido}
                    returnKeyType="done"
                    blurOnSubmit={false}
                  />
                </View>
              )}
              {items.length > 0 && datos.length > 0 && (
                <Boton titulo="Cerrar compra" variante="secundario" icono="lock-closed-outline" onPress={cerrarCompra} />
              )}
            </View>
          }
        />
      )}

      {lista && (
        <Pressable
          style={({ pressed }) => [s.fab, { bottom: 16, opacity: pressed ? 0.85 : 1 }]}
          onPress={() => router.push('/importar')}
          accessibilityLabel="Pegar nueva lista de WhatsApp"
        >
          <Icono name="clipboard-outline" color="#fff" size={22} />
          <Text style={s.fabTexto}>Pegar lista</Text>
        </Pressable>
      )}

      <RegistroSheet
        item={seleccionado}
        referencia={seleccionado ? referencias.get(seleccionado.producto_id) : undefined}
        ultimaFoto={ultimaFoto}
        onCerrar={() => setSeleccionado(null)}
      />
    </View>
  );
}

function FilaItem({
  item,
  referencia,
  onPress,
  onLongPress,
}: {
  item: Item;
  referencia?: ReferenciaPrecio;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const comprado = !!item.comprado;
  const unidad = item.unidad ? ` ${item.unidad}` : '';
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [estilos.tarjeta, s.fila, pressed && { backgroundColor: '#F0F3F6' }]}
    >
      <Icono
        name={comprado ? 'checkmark-circle' : 'ellipse-outline'}
        size={32}
        color={comprado ? colores.primario : colores.borde}
      />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={s.filaEntre}>
          <Text style={[s.nombre, comprado && s.nombreComprado]} numberOfLines={2}>
            {item.producto_nombre}
          </Text>
          {comprado ? (
            <Text style={s.precio}>{formatBs(item.precio_pagado_bs)}</Text>
          ) : item.cantidad_pedida != null ? (
            <Text style={s.cantidad}>
              {formatCantidad(item.cantidad_pedida)}
              {unidad}
            </Text>
          ) : null}
        </View>

        {comprado ? (
          <View style={s.detalleFila}>
            <Text style={s.detalle} numberOfLines={1}>
              {formatCantidad(item.cantidad_comprada)}
              {unidad}
              {item.cantidad_pedida != null && item.cantidad_comprada !== item.cantidad_pedida
                ? ` de ${formatCantidad(item.cantidad_pedida)}`
                : ''}{' '}
              · {item.comercio_nombre} · {item.metodo_pago}
            </Text>
            {item.foto_factura_uri && <Icono name="receipt-outline" size={16} color={colores.textoSuave} />}
          </View>
        ) : referencia ? (
          <View style={{ gap: 2 }}>
            <Text style={s.referencia} numberOfLines={1}>
              Último: {formatBs(referencia.ultimo.precio_unitario_bs)}
              {referencia.ultimo.unidad ? `/${referencia.ultimo.unidad}` : ''} · {referencia.ultimo.comercio_nombre} ·{' '}
              {haceCuanto(referencia.ultimo.fecha)}
            </Text>
            {referencia.masBarato && (
              <Text style={s.barato} numberOfLines={1}>
                Más barato: {formatBs(referencia.masBarato.precio_unitario_bs)} · {referencia.masBarato.comercio_nombre}
              </Text>
            )}
          </View>
        ) : (
          <Text style={s.sinReferencia}>Sin precio anterior</Text>
        )}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colores.fondo },
  encabezado: {
    backgroundColor: colores.superficie,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colores.borde,
  },
  filaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  fecha: { fontSize: 20, fontWeight: '700', color: colores.texto, textTransform: 'capitalize' },
  progresoTexto: { fontSize: 15, color: colores.textoSuave, marginTop: 2 },
  totalEtiqueta: { fontSize: 13, color: colores.textoSuave },
  total: { fontSize: 24, fontWeight: '800', color: colores.primario },
  barra: { height: 8, borderRadius: 4, backgroundColor: colores.primarioSuave, overflow: 'hidden' },
  barraRelleno: { height: '100%', backgroundColor: colores.primario, borderRadius: 4 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  nombre: { flex: 1, fontSize: 17, fontWeight: '600', color: colores.texto },
  nombreComprado: { color: colores.textoSuave },
  cantidad: { fontSize: 16, fontWeight: '700', color: colores.texto },
  precio: { fontSize: 16, fontWeight: '700', color: colores.primario },
  detalleFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detalle: { flex: 1, fontSize: 14, color: colores.textoSuave },
  referencia: { fontSize: 14, color: colores.acento },
  barato: { fontSize: 13, color: colores.primario, fontWeight: '600' },
  sinReferencia: { fontSize: 13, color: colores.textoSuave, fontStyle: 'italic' },
  agregar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colores.superficie,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colores.borde,
    borderStyle: 'dashed',
  },
  agregarInput: { flex: 1, minHeight: 52, fontSize: 16, color: colores.texto },
  fab: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colores.acento,
    paddingHorizontal: 20,
    height: 56,
    borderRadius: 28,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fabTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
