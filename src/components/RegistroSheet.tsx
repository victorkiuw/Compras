import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as repo from '../db/repo';
import type { Item, MetodoPago, ReferenciaPrecio } from '../db/repo';
import { formatBs, formatCantidad, formatNumero, haceCuanto, parseMonto } from '../lib/format';
import { obtenerFotoFactura } from '../lib/fotos';
import { useCompraStore } from '../store/useCompraStore';
import { Boton, Chip, colores, estilos, Icono, Segmentado } from './ui';

type ModoPrecio = 'unitario' | 'total';

export function RegistroSheet({
  item,
  referencia,
  ultimaFoto,
  onCerrar,
}: {
  item: Item | null;
  referencia?: ReferenciaPrecio;
  ultimaFoto: string | null;
  onCerrar: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { comercios, ultimoComercioId, ultimoMetodo, registrar, deshacer, recargarComercios } = useCompraStore();

  const [cantidadTxt, setCantidadTxt] = useState('1');
  const [modoPrecio, setModoPrecio] = useState<ModoPrecio>('total');
  const [montoTxt, setMontoTxt] = useState('');
  const [comercioId, setComercioId] = useState<number | null>(null);
  const [metodo, setMetodo] = useState<MetodoPago>('Tarjeta');
  const [foto, setFoto] = useState<string | null>(null);
  const [nuevoComercio, setNuevoComercio] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Precarga los campos cada vez que se abre con un ítem.
  useEffect(() => {
    if (!item) return;
    const yaComprado = !!item.comprado;
    setCantidadTxt(formatCantidad(yaComprado ? item.cantidad_comprada : item.cantidad_pedida ?? 1) || '1');
    setModoPrecio('total');
    setMontoTxt(yaComprado && item.precio_pagado_bs != null ? formatNumero(item.precio_pagado_bs) : '');
    setComercioId(
      item.comercio_id ??
        (ultimoComercioId && comercios.some((c) => c.id === ultimoComercioId) ? ultimoComercioId : comercios[0]?.id ?? null),
    );
    setMetodo(item.metodo_pago ?? ultimoMetodo);
    setFoto(item.foto_factura_uri);
    setNuevoComercio(null);
    setGuardando(false);
  }, [item?.id]);

  const cantidad = parseMonto(cantidadTxt) ?? 0;
  const monto = parseMonto(montoTxt) ?? 0;
  const total = modoPrecio === 'total' ? monto : monto * cantidad;
  const unitario = modoPrecio === 'unitario' ? monto : cantidad > 0 ? monto / cantidad : 0;

  const refComercio = referencia?.ultimo ?? null;

  const ajustarCantidad = (delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    const siguiente = Math.max(0, Math.round((cantidad + delta) * 100) / 100);
    setCantidadTxt(formatCantidad(siguiente));
  };

  const usarPrecioAnterior = () => {
    if (!refComercio) return;
    setModoPrecio('unitario');
    setMontoTxt(formatNumero(refComercio.precio_unitario_bs));
  };

  const agregarComercio = async () => {
    const nombre = nuevoComercio?.trim();
    if (!nombre) return setNuevoComercio(null);
    const id = await repo.crearComercio(nombre, 'Supermercado');
    await recargarComercios();
    setComercioId(id);
    setNuevoComercio(null);
  };

  const tomarFoto = async (origen: 'camara' | 'galeria') => {
    const uri = await obtenerFotoFactura(origen);
    if (uri) setFoto(uri);
  };

  const guardar = async () => {
    if (!item) return;
    if (cantidad <= 0) return Alert.alert('Cantidad', 'Indica cuánto compraste.');
    if (total <= 0) return Alert.alert('Precio', 'Indica el precio pagado en Bs.');
    if (!comercioId) return Alert.alert('Comercio', 'Elige o agrega el comercio donde compraste.');
    setGuardando(true);
    try {
      await registrar(item.id, { cantidad, totalBs: total, comercioId, metodo, fotoUri: foto });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onCerrar();
    } catch (e) {
      setGuardando(false);
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : String(e));
    }
  };

  const desmarcar = async () => {
    if (!item) return;
    await deshacer(item.id);
    onCerrar();
  };

  const unidad = item?.unidad ? ` ${item.unidad}` : '';

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onCerrar} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.fondo} onPress={onCerrar} accessibilityLabel="Cerrar" />
        <View style={[s.hoja, { paddingBottom: insets.bottom + 12 }]}>
          <View style={s.asa} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16, paddingBottom: 8 }}>
            <View>
              <Text style={s.titulo} numberOfLines={2}>
                {item?.producto_nombre}
              </Text>
              {item?.cantidad_pedida != null && (
                <Text style={s.subtitulo}>
                  Pedido: {formatCantidad(item.cantidad_pedida)}
                  {unidad}
                </Text>
              )}
            </View>

            {/* Cantidad */}
            <View style={{ gap: 6 }}>
              <Text style={estilos.etiqueta}>Cantidad comprada{unidad && ` (${item?.unidad})`}</Text>
              <View style={s.fila}>
                <Pressable style={s.paso} onPress={() => ajustarCantidad(-1)} accessibilityLabel="Restar uno">
                  <Icono name="remove" size={26} />
                </Pressable>
                <TextInput
                  style={[estilos.input, s.inputCantidad]}
                  value={cantidadTxt}
                  onChangeText={setCantidadTxt}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                />
                <Pressable style={s.paso} onPress={() => ajustarCantidad(1)} accessibilityLabel="Sumar uno">
                  <Icono name="add" size={26} />
                </Pressable>
              </View>
              {item?.cantidad_pedida != null && cantidad > 0 && cantidad !== item.cantidad_pedida && (
                <Text style={[s.nota, { color: colores.aviso }]}>
                  {cantidad < item.cantidad_pedida ? 'Menos' : 'Más'} de lo pedido ({formatCantidad(item.cantidad_pedida)}
                  {unidad})
                </Text>
              )}
            </View>

            {/* Precio */}
            <View style={{ gap: 6 }}>
              <Segmentado
                opciones={[
                  { valor: 'total', etiqueta: 'Monto total' },
                  { valor: 'unitario', etiqueta: 'Precio unitario' },
                ]}
                valor={modoPrecio}
                onCambio={setModoPrecio}
              />
              <View style={s.fila}>
                <Text style={s.prefijo}>Bs.</Text>
                <TextInput
                  style={[estilos.input, { flex: 1, fontSize: 22, fontWeight: '600' }]}
                  value={montoTxt}
                  onChangeText={setMontoTxt}
                  keyboardType="decimal-pad"
                  placeholder="0,00"
                  placeholderTextColor={colores.borde}
                  autoFocus={!item?.comprado}
                  selectTextOnFocus
                />
              </View>
              {monto > 0 && cantidad > 0 && (
                <Text style={s.nota}>
                  {modoPrecio === 'total'
                    ? `Unitario: ${formatBs(unitario)}${unidad && ` / ${item?.unidad}`}`
                    : `Total a pagar: ${formatBs(total)}`}
                </Text>
              )}
              {refComercio && (
                <Pressable onPress={usarPrecioAnterior} style={s.referencia}>
                  <Icono name="time-outline" size={16} color={colores.acento} />
                  <Text style={s.referenciaTexto}>
                    Último: {formatBs(refComercio.precio_unitario_bs)} en {refComercio.comercio_nombre} ·{' '}
                    {haceCuanto(refComercio.fecha)}
                    {monto > 0 && unitario > 0 && (() => {
                      const dif = ((unitario - refComercio.precio_unitario_bs) / refComercio.precio_unitario_bs) * 100;
                      if (Math.abs(dif) < 0.5) return '  (igual)';
                      return `  (${dif > 0 ? '+' : ''}${formatNumero(dif, 0)}%)`;
                    })()}
                  </Text>
                </Pressable>
              )}
              {referencia?.masBarato && (
                <Text style={[s.nota, { color: colores.primario }]}>
                  Más barato antes: {formatBs(referencia.masBarato.precio_unitario_bs)} en {referencia.masBarato.comercio_nombre}
                </Text>
              )}
            </View>

            {/* Comercio */}
            <View style={{ gap: 6 }}>
              <Text style={estilos.etiqueta}>Comercio</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
                {comercios.map((c) => (
                  <Chip key={c.id} texto={c.nombre} activo={c.id === comercioId} onPress={() => setComercioId(c.id)} />
                ))}
                {nuevoComercio === null && <Chip texto="Nuevo" icono="add" activo={false} onPress={() => setNuevoComercio('')} />}
              </ScrollView>
              {nuevoComercio !== null && (
                <View style={s.fila}>
                  <TextInput
                    style={[estilos.input, { flex: 1, fontSize: 16 }]}
                    placeholder="Nombre del comercio"
                    value={nuevoComercio}
                    onChangeText={setNuevoComercio}
                    autoFocus
                    onSubmitEditing={agregarComercio}
                    returnKeyType="done"
                  />
                  <Boton titulo="Agregar" onPress={agregarComercio} />
                </View>
              )}
            </View>

            {/* Método de pago */}
            <View style={{ gap: 6 }}>
              <Text style={estilos.etiqueta}>Método de pago</Text>
              <Segmentado
                opciones={[
                  { valor: 'Tarjeta', etiqueta: 'Tarjeta', icono: 'card-outline' },
                  { valor: 'Pago Móvil', etiqueta: 'Pago Móvil', icono: 'phone-portrait-outline' },
                ]}
                valor={metodo}
                onCambio={setMetodo}
              />
            </View>

            {/* Foto del ticket */}
            <View style={{ gap: 6 }}>
              <Text style={estilos.etiqueta}>Ticket / factura</Text>
              {foto ? (
                <View style={s.fila}>
                  <Image source={{ uri: foto }} style={s.miniatura} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <Boton titulo="Cambiar" variante="secundario" icono="camera-outline" onPress={() => tomarFoto('camara')} />
                    <Boton titulo="Quitar" variante="texto" onPress={() => setFoto(null)} />
                  </View>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  <View style={s.fila}>
                    <Boton titulo="Cámara" variante="secundario" icono="camera-outline" onPress={() => tomarFoto('camara')} style={{ flex: 1 }} />
                    <Boton titulo="Galería" variante="secundario" icono="images-outline" onPress={() => tomarFoto('galeria')} style={{ flex: 1 }} />
                  </View>
                  {ultimaFoto && (
                    <Boton titulo="Usar el mismo ticket anterior" variante="texto" icono="receipt-outline" onPress={() => setFoto(ultimaFoto)} />
                  )}
                </View>
              )}
            </View>
          </ScrollView>

          <View style={[s.fila, { paddingTop: 10 }]}>
            {item?.comprado ? <Boton titulo="Desmarcar" variante="secundario" onPress={desmarcar} /> : null}
            <Boton
              titulo={total > 0 ? `Guardar · ${formatBs(total)}` : 'Guardar'}
              icono="checkmark"
              onPress={guardar}
              deshabilitado={guardando}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  hoja: {
    backgroundColor: colores.fondo,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: '92%',
  },
  asa: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colores.borde, marginBottom: 10 },
  titulo: { fontSize: 22, fontWeight: '700', color: colores.texto },
  subtitulo: { fontSize: 15, color: colores.textoSuave, marginTop: 2 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paso: {
    width: 56,
    height: 52,
    borderRadius: 12,
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.borde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputCantidad: { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '600' },
  prefijo: { fontSize: 20, fontWeight: '600', color: colores.textoSuave },
  nota: { fontSize: 14, color: colores.textoSuave },
  referencia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colores.acentoSuave,
    padding: 10,
    borderRadius: 10,
  },
  referenciaTexto: { flex: 1, fontSize: 14, color: colores.acento },
  miniatura: { width: 96, height: 128, borderRadius: 10, backgroundColor: colores.borde },
});
