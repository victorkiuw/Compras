import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FacturaSheet, type AperturaFactura } from '../../components/FacturaSheet';
import { TasaModal } from '../../components/TasaModal';
import { Boton, colores, estilos, Icono, Segmentado, Vacio } from '../../components/ui';
import * as repo from '../../db/repo';
import type { Factura, Item, ReferenciaPrecio } from '../../db/repo';
import { formatBs, formatCantidad, formatFecha, formatTasa, formatUsd, haceCuanto } from '../../lib/format';
import { parseLinea } from '../../lib/parser';
import { bsHoy, formatPrecioRef } from '../../lib/precios';
import { totalGastado, useCompraStore } from '../../store/useCompraStore';

type Pestana = 'pendientes' | 'comprados';

export default function ModoCompra() {
  const insets = useSafeAreaInsets();
  const { lista, items, facturas, referencias, tasaBs, tasaFecha, setTasa, recargar, eliminarItems, cerrar } = useCompraStore();
  const [pestana, setPestana] = useState<Pestana>('pendientes');
  const [apertura, setApertura] = useState<AperturaFactura | null>(null);
  const [seleccion, setSeleccion] = useState<Set<number> | null>(null);
  const [nuevoTexto, setNuevoTexto] = useState('');
  const [editandoTasa, setEditandoTasa] = useState(false);

  useFocusEffect(
    useCallback(() => {
      recargar();
    }, [recargar]),
  );

  const pendientes = useMemo(() => items.filter((i) => !i.comprado), [items]);
  const comprados = items.length - pendientes.length;
  const total = totalGastado(items);
  const progreso = items.length ? comprados / items.length : 0;
  const tasaEsDeHoy = !!tasaFecha && haceCuanto(tasaFecha) === 'hoy';

  const agregarRapido = async () => {
    const parseado = parseLinea(nuevoTexto);
    if (!parseado) return;
    if (lista) await repo.agregarItems(lista.id, [parseado]);
    else await repo.importarItems([parseado], 'nueva');
    setNuevoTexto('');
    await recargar();
  };

  const alternarSeleccion = (id: number) =>
    setSeleccion((prev) => {
      const sig = new Set(prev ?? []);
      if (sig.has(id)) sig.delete(id);
      else sig.add(id);
      return sig.size ? sig : null;
    });

  const tocarPendiente = (item: Item) => {
    if (seleccion) alternarSeleccion(item.id);
    else setApertura({ facturaId: null, itemIds: [item.id] });
  };

  const mantenerPendiente = (item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    alternarSeleccion(item.id);
  };

  const registrarSeleccion = () => {
    if (!seleccion) return;
    setApertura({ facturaId: null, itemIds: pendientes.filter((i) => seleccion.has(i.id)).map((i) => i.id) });
    setSeleccion(null);
  };

  const eliminarSeleccion = () => {
    if (!seleccion) return;
    const ids = [...seleccion];
    Alert.alert('Eliminar de la lista', `¿Quitar ${ids.length} ${ids.length === 1 ? 'producto' : 'productos'} de la lista?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await eliminarItems(ids);
          setSeleccion(null);
        },
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
    Alert.alert(
      'Cerrar compra',
      `Total: ${formatBs(total.bs)}${total.usd ? ` (${formatUsd(total.usd)})` : ''}\n${comprados} de ${items.length} productos comprados.`,
      botones,
    );
  };

  const pie = (
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
            submitBehavior="submit"
          />
        </View>
      )}
      {items.length > 0 && (pestana === 'comprados' ? facturas.length > 0 : pendientes.length > 0) && (
        <Boton titulo="Cerrar compra" variante="secundario" icono="lock-closed-outline" onPress={cerrarCompra} />
      )}
    </View>
  );

  return (
    <View style={[s.pantalla, { paddingTop: insets.top }]}>
      {/* Encabezado: fecha, progreso, total y tasa */}
      <View style={s.encabezado}>
        <View style={s.filaEntre}>
          <View style={{ flexShrink: 1 }}>
            <Text style={s.fecha}>{formatFecha(lista?.fecha ?? new Date().toISOString())}</Text>
            <Text style={s.progresoTexto}>
              {comprados}/{items.length} productos
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.total}>{formatBs(total.bs)}</Text>
            {total.usd > 0 && <Text style={s.totalUsd}>{formatUsd(total.usd)}</Text>}
          </View>
        </View>
        <View style={s.barra}>
          <View style={[s.barraRelleno, { width: `${progreso * 100}%` }]} />
        </View>
        <Pressable
          onPress={() => setEditandoTasa(true)}
          style={[s.tasa, !tasaEsDeHoy && { backgroundColor: colores.avisoSuave }]}
          accessibilityLabel="Cambiar tasa del día"
        >
          <Icono name="swap-horizontal" size={18} color={tasaEsDeHoy ? colores.acento : colores.aviso} />
          <Text style={[s.tasaTexto, !tasaEsDeHoy && { color: colores.aviso }]}>
            {tasaBs ? `Tasa: ${formatTasa(tasaBs)}${tasaEsDeHoy ? '' : ` · ${haceCuanto(tasaFecha!)}, ¿actualizar?`}` : 'Fija la tasa del día (Bs por $)'}
          </Text>
          <Icono name="create-outline" size={18} color={tasaEsDeHoy ? colores.acento : colores.aviso} />
        </Pressable>
        {lista && (
          <Segmentado
            opciones={[
              { valor: 'pendientes', etiqueta: `Pendientes (${pendientes.length})` },
              { valor: 'comprados', etiqueta: `Comprados (${comprados})` },
            ]}
            valor={pestana}
            onCambio={(p) => {
              setSeleccion(null);
              setPestana(p);
            }}
          />
        )}
      </View>

      {!lista ? (
        <Vacio icono="cart-outline" titulo="No hay compra activa" texto="Copia la lista que te mandaron por WhatsApp y pégala aquí para empezar.">
          <Boton titulo="Pegar lista de WhatsApp" icono="clipboard-outline" onPress={() => router.push('/importar')} />
        </Vacio>
      ) : pestana === 'pendientes' ? (
        <FlatList
          data={pendientes}
          keyExtractor={(i) => String(i.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 120 }}
          ListHeaderComponent={
            pendientes.length > 1 && !seleccion ? (
              <Text style={s.ayuda}>Mantén presionado para elegir varios y registrarlos en una misma factura.</Text>
            ) : null
          }
          renderItem={({ item }) => (
            <FilaPendiente
              item={item}
              referencia={referencias.get(item.producto_id)}
              tasa={tasaBs}
              seleccionado={seleccion?.has(item.id) ?? null}
              onPress={() => tocarPendiente(item)}
              onLongPress={() => mantenerPendiente(item)}
            />
          )}
          ListEmptyComponent={
            <Vacio icono="checkmark-done-circle-outline" titulo="¡Todo comprado!" texto={`Total: ${formatBs(total.bs)}`}>
              <Boton titulo="Cerrar compra" icono="lock-closed-outline" onPress={cerrarCompra} />
            </Vacio>
          }
          ListFooterComponent={pie}
        />
      ) : (
        <FlatList
          data={facturas}
          keyExtractor={(f) => String(f.id)}
          contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 120 }}
          renderItem={({ item }) => (
            <TarjetaFactura
              factura={item}
              items={items.filter((i) => i.factura_id === item.id)}
              onPress={() => setApertura({ facturaId: item.id, itemIds: [] })}
            />
          )}
          ListEmptyComponent={
            <Vacio icono="basket-outline" titulo="Aún no has marcado productos" texto="Toca un producto pendiente para registrarlo." />
          }
          ListFooterComponent={pie}
        />
      )}

      {seleccion ? (
        <View style={[s.barraSeleccion, { paddingBottom: 12 }]}>
          <Pressable onPress={() => setSeleccion(null)} hitSlop={10} accessibilityLabel="Cancelar selección">
            <Icono name="close" size={26} />
          </Pressable>
          <Text style={s.seleccionTexto}>{seleccion.size}</Text>
          <Boton titulo="" icono="trash-outline" variante="secundario" onPress={eliminarSeleccion} style={{ paddingHorizontal: 14 }} />
          <Boton titulo="Registrar en una factura" icono="receipt-outline" onPress={registrarSeleccion} style={{ flex: 1 }} />
        </View>
      ) : (
        lista && (
          <Pressable
            style={({ pressed }) => [s.fab, { opacity: pressed ? 0.85 : 1 }]}
            onPress={() => router.push('/importar')}
            accessibilityLabel="Pegar nueva lista de WhatsApp"
          >
            <Icono name="clipboard-outline" color="#fff" size={22} />
            <Text style={s.fabTexto}>Pegar lista</Text>
          </Pressable>
        )
      )}

      <FacturaSheet apertura={apertura} onCerrar={() => setApertura(null)} />
      <TasaModal visible={editandoTasa} tasaActual={tasaBs} onGuardar={setTasa} onCerrar={() => setEditandoTasa(false)} />
    </View>
  );
}

function FilaPendiente({
  item,
  referencia,
  tasa,
  seleccionado,
  onPress,
  onLongPress,
}: {
  item: Item;
  referencia?: ReferenciaPrecio;
  tasa: number | null;
  /** null = no se está seleccionando */
  seleccionado: boolean | null;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const unidad = item.unidad ? ` ${item.unidad}` : '';
  const hoy = referencia ? bsHoy(referencia.ultimo, tasa) : null;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        estilos.tarjeta,
        s.fila,
        seleccionado && { borderColor: colores.primario, backgroundColor: colores.primarioSuave },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Icono
        name={seleccionado ? 'checkbox' : seleccionado === false ? 'square-outline' : 'ellipse-outline'}
        size={30}
        color={seleccionado ? colores.primario : colores.borde}
      />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={s.filaEntre}>
          <Text style={s.nombre} numberOfLines={2}>
            {item.producto_nombre}
          </Text>
          {item.cantidad_pedida != null && (
            <Text style={s.cantidad}>
              {formatCantidad(item.cantidad_pedida)}
              {unidad}
            </Text>
          )}
        </View>
        {referencia ? (
          <View style={{ gap: 2 }}>
            <Text style={s.referencia} numberOfLines={2}>
              Último: {formatPrecioRef(referencia.ultimo)}
              {referencia.ultimo.unidad ? `/${referencia.ultimo.unidad}` : ''}
              {hoy != null ? ` (≈ ${formatBs(hoy)} hoy)` : ''} · {referencia.ultimo.comercio_nombre} · {haceCuanto(referencia.ultimo.fecha)}
            </Text>
            {referencia.masBarato && (
              <Text style={s.barato} numberOfLines={1}>
                Más barato: {formatPrecioRef(referencia.masBarato)} · {referencia.masBarato.comercio_nombre}
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

function TarjetaFactura({ factura, items, onPress }: { factura: Factura; items: Item[]; onPress: () => void }) {
  const hora = new Date(factura.fecha);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [estilos.tarjeta, { gap: 8 }, pressed && { opacity: 0.85 }]}>
      <View style={s.filaEntre}>
        <View style={{ flex: 1 }}>
          <Text style={s.facturaComercio}>{factura.comercio_nombre ?? 'Sin comercio'}</Text>
          <Text style={s.detalle}>
            {String(hora.getHours()).padStart(2, '0')}:{String(hora.getMinutes()).padStart(2, '0')} · {factura.metodo_pago}
            {factura.tasa_bs ? ` · ${formatTasa(factura.tasa_bs)}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.precio}>{formatBs(factura.total_bs)}</Text>
          {factura.total_usd != null && <Text style={s.detalle}>{formatUsd(factura.total_usd)}</Text>}
        </View>
        {factura.foto_uri && <Image source={{ uri: factura.foto_uri }} style={s.miniatura} />}
      </View>
      {items.map((i) => (
        <View key={i.id} style={s.lineaFactura}>
          <Icono name="checkmark-circle" size={18} color={colores.primario} />
          <Text style={s.lineaNombre} numberOfLines={1}>
            {i.producto_nombre}
          </Text>
          <Text style={s.detalle}>
            {formatCantidad(i.cantidad_comprada)}
            {i.unidad ? ` ${i.unidad}` : ''}
          </Text>
          <Text style={s.lineaPrecio}>{i.precio_pagado_usd != null ? formatUsd(i.precio_pagado_usd) : formatBs(i.precio_pagado_bs)}</Text>
        </View>
      ))}
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
  total: { fontSize: 22, fontWeight: '800', color: colores.primario },
  totalUsd: { fontSize: 15, fontWeight: '600', color: colores.textoSuave },
  barra: { height: 8, borderRadius: 4, backgroundColor: colores.primarioSuave, overflow: 'hidden' },
  barraRelleno: { height: '100%', backgroundColor: colores.primario, borderRadius: 4 },
  tasa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colores.acentoSuave,
  },
  tasaTexto: { flex: 1, fontSize: 15, fontWeight: '600', color: colores.acento },
  ayuda: { fontSize: 13, color: colores.textoSuave, textAlign: 'center', marginBottom: 2 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  nombre: { flex: 1, fontSize: 17, fontWeight: '600', color: colores.texto },
  cantidad: { fontSize: 16, fontWeight: '700', color: colores.texto },
  precio: { fontSize: 16, fontWeight: '700', color: colores.primario },
  detalle: { fontSize: 14, color: colores.textoSuave },
  referencia: { fontSize: 14, color: colores.acento },
  barato: { fontSize: 13, color: colores.primario, fontWeight: '600' },
  sinReferencia: { fontSize: 13, color: colores.textoSuave, fontStyle: 'italic' },
  facturaComercio: { fontSize: 17, fontWeight: '700', color: colores.texto },
  miniatura: { width: 40, height: 52, borderRadius: 6, backgroundColor: colores.borde },
  lineaFactura: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineaNombre: { flex: 1, fontSize: 15, color: colores.texto },
  lineaPrecio: { fontSize: 15, fontWeight: '600', color: colores.texto, minWidth: 64, textAlign: 'right' },
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
    bottom: 16,
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
  barraSeleccion: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colores.superficie,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colores.borde,
    elevation: 8,
  },
  seleccionTexto: { fontSize: 18, fontWeight: '700', color: colores.texto, minWidth: 20 },
});
