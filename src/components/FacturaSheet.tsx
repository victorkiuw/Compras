import * as Haptics from 'expo-haptics';
import { useState } from 'react';
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
import { METODOS_PAGO, type Item, type MetodoPago } from '../db/repo';
import { convertir, formatBs, formatCantidad, formatFecha, formatNumero, formatUsd, haceCuanto, parseMonto, type Moneda } from '../lib/format';
import { obtenerFotoFactura } from '../lib/fotos';
import { formatPrecioRef } from '../lib/precios';
import { useCompraStore } from '../store/useCompraStore';
import { Boton, Chip, colores, estilos, Icono, Segmentado } from './ui';

export interface AperturaFactura {
  /** null = factura nueva */
  facturaId: number | null;
  /** Productos con los que se abre (para una factura nueva). */
  itemIds: number[];
}

type ModoPrecio = 'unitario' | 'total';

/** Desde este % de subida frente a la última compra se muestra la alerta de precio. */
const UMBRAL_ALERTA = 15;

const ICONO_METODO: Record<MetodoPago, Parameters<typeof Icono>[0]['name']> = {
  Tarjeta: 'card-outline',
  'Pago Móvil': 'phone-portrait-outline',
  Efectivo: 'cash-outline',
  Crédito: 'time-outline',
};

function sumarDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

interface Linea {
  itemId: number;
  cantidadTxt: string;
  precioTxt: string;
}

/**
 * Hoja inferior para registrar una compra. Una factura agrupa uno o varios productos
 * que comparten comercio, método de pago, tasa de cambio y foto del ticket.
 */
export function FacturaSheet({ apertura, onCerrar }: { apertura: AperturaFactura | null; onCerrar: () => void }) {
  // Se monta de nuevo en cada apertura, así el estado arranca limpio con los datos de ese momento.
  if (!apertura) return null;
  return <HojaFactura apertura={apertura} onCerrar={onCerrar} />;
}

interface EstadoInicial {
  lineas: Linea[];
  modoPrecio: ModoPrecio;
  moneda: Moneda;
  tasaTxt: string | null;
  comercioId: number | null;
  metodo: MetodoPago;
  foto: string | null;
  vence: string | null;
}

function estadoInicial(apertura: AperturaFactura, st: ReturnType<typeof useCompraStore.getState>): EstadoInicial {
  const { items, facturas, comercios } = st;
  const factura = apertura.facturaId != null ? facturas.find((f) => f.id === apertura.facturaId) : undefined;
  if (factura) {
    const suyos = items.filter((i) => i.factura_id === factura.id);
    const moneda: Moneda = st.moneda === 'USD' && suyos.every((i) => i.precio_pagado_usd != null) ? 'USD' : 'BS';
    return {
      moneda,
      modoPrecio: 'total',
      lineas: suyos.map((i) => ({
        itemId: i.id,
        cantidadTxt: formatCantidad(i.cantidad_comprada) || '1',
        precioTxt: formatNumero((moneda === 'USD' ? i.precio_pagado_usd : i.precio_pagado_bs) ?? 0),
      })),
      tasaTxt: factura.tasa_bs ? formatNumero(factura.tasa_bs) : null,
      comercioId: factura.comercio_id,
      metodo: factura.metodo_pago ?? st.ultimoMetodo,
      foto: factura.foto_uri,
      vence: factura.vence,
    };
  }
  return {
    moneda: st.moneda,
    modoPrecio: 'unitario',
    lineas: apertura.itemIds.map((id) => nuevaLinea(items.find((i) => i.id === id))),
    tasaTxt: null,
    comercioId:
      st.ultimoComercioId && comercios.some((c) => c.id === st.ultimoComercioId) ? st.ultimoComercioId : comercios[0]?.id ?? null,
    metodo: st.ultimoMetodo,
    foto: null,
    vence: null,
  };
}

function HojaFactura({ apertura, onCerrar }: { apertura: AperturaFactura; onCerrar: () => void }) {
  const insets = useSafeAreaInsets();
  const st = useCompraStore();
  const { items, referencias, comercios } = st;
  const [inicial] = useState(() => estadoInicial(apertura, useCompraStore.getState()));

  const [lineas, setLineas] = useState<Linea[]>(inicial.lineas);
  const [modoPrecio, setModoPrecio] = useState<ModoPrecio>(inicial.modoPrecio);
  const [moneda, setMonedaLocal] = useState<Moneda>(inicial.moneda);
  // null = usar la tasa del día (se completa sola si llega la automática con la hoja abierta).
  const [tasaEditada, setTasaTxt] = useState<string | null>(inicial.tasaTxt);
  const [comercioId, setComercioId] = useState<number | null>(inicial.comercioId);
  const [metodo, setMetodo] = useState<MetodoPago>(inicial.metodo);
  const [foto, setFoto] = useState<string | null>(inicial.foto);
  const [vence, setVence] = useState<string | null>(inicial.vence);
  const [nuevoComercio, setNuevoComercio] = useState<string | null>(null);
  const [mostrarPendientes, setMostrarPendientes] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const tasaTxt = tasaEditada ?? (st.tasaBs ? formatNumero(st.tasaBs) : '');
  const tasa = parseMonto(tasaTxt);
  const itemDe = (id: number) => items.find((i) => i.id === id);

  const calcular = (l: Linea) => {
    const cantidad = parseMonto(l.cantidadTxt) ?? 0;
    const monto = parseMonto(l.precioTxt) ?? 0;
    const totalMoneda = modoPrecio === 'total' ? monto : monto * cantidad;
    const { usd, bs } = convertir(totalMoneda, moneda, tasa);
    const unitarioUsd = usd != null && cantidad > 0 ? usd / cantidad : null;
    const unitarioBs = bs != null && cantidad > 0 ? bs / cantidad : null;
    return { cantidad, monto, usd, bs, unitarioUsd, unitarioBs };
  };

  const totales = lineas.reduce(
    (acc, l) => {
      const c = calcular(l);
      return { usd: acc.usd + (c.usd ?? 0), bs: acc.bs + (c.bs ?? 0) };
    },
    { usd: 0, bs: 0 },
  );

  const actualizar = (itemId: number, cambios: Partial<Linea>) =>
    setLineas((ls) => ls.map((l) => (l.itemId === itemId ? { ...l, ...cambios } : l)));

  const cambiarMoneda = (m: Moneda) => {
    if (m === moneda) return;
    // Convierte lo ya escrito para no tener que volver a teclearlo.
    if (tasa) {
      setLineas((ls) =>
        ls.map((l) => {
          const v = parseMonto(l.precioTxt);
          if (!v) return l;
          return { ...l, precioTxt: formatNumero(m === 'BS' ? v * tasa : v / tasa) };
        }),
      );
    }
    setMonedaLocal(m);
    st.setMoneda(m);
  };

  const cambiarModo = (m: ModoPrecio) => {
    if (m === modoPrecio) return;
    setLineas((ls) =>
      ls.map((l) => {
        const cantidad = parseMonto(l.cantidadTxt) ?? 0;
        const v = parseMonto(l.precioTxt);
        if (!v || !cantidad) return l;
        return { ...l, precioTxt: formatNumero(m === 'total' ? v * cantidad : v / cantidad) };
      }),
    );
    setModoPrecio(m);
  };

  const pasoCantidad = (l: Linea, delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    const actual = parseMonto(l.cantidadTxt) ?? 0;
    actualizar(l.itemId, { cantidadTxt: formatCantidad(Math.max(0, Math.round((actual + delta) * 100) / 100)) });
  };

  const usarPrecioAnterior = (l: Linea, item: Item) => {
    const ref = referencias.get(item.producto_id)?.ultimo;
    if (!ref) return;
    let unit: number | null;
    if (moneda === 'USD') unit = ref.precio_unitario_usd ?? (tasa ? ref.precio_unitario_bs / tasa : null);
    else unit = ref.precio_unitario_usd != null && tasa ? ref.precio_unitario_usd * tasa : ref.precio_unitario_bs;
    if (unit == null) return;
    const cantidad = parseMonto(l.cantidadTxt) ?? 1;
    actualizar(l.itemId, { precioTxt: formatNumero(modoPrecio === 'total' ? unit * cantidad : unit) });
  };

  const pendientesDisponibles = items.filter((i) => !i.comprado && !lineas.some((l) => l.itemId === i.id));

  const agregarComercio = async () => {
    const nombre = nuevoComercio?.trim();
    if (!nombre) return setNuevoComercio(null);
    const id = await repo.crearComercio(nombre, 'Supermercado');
    await st.recargarComercios();
    setComercioId(id);
    setNuevoComercio(null);
  };

  const tomarFoto = async (origen: 'camara' | 'galeria') => {
    const uri = await obtenerFotoFactura(origen);
    if (uri) setFoto(uri);
  };

  const guardar = async () => {
    if (!apertura || !lineas.length) return;
    if (moneda === 'USD' && !tasa) return Alert.alert('Falta la tasa', 'Indica la tasa (Bs por $) para saber cuánto pagas en bolívares.');
    if (metodo === 'Crédito' && !tasa)
      return Alert.alert('Falta la tasa', 'Las deudas a crédito se llevan en dólares: indica la tasa para convertir.');
    for (const l of lineas) {
      const c = calcular(l);
      const nombre = itemDe(l.itemId)?.producto_nombre ?? '';
      if (c.cantidad <= 0) return Alert.alert('Cantidad', `Indica cuánto compraste de ${nombre}.`);
      if (c.monto <= 0) return Alert.alert('Precio', `Indica el precio de ${nombre}.`);
    }
    if (!comercioId) return Alert.alert('Comercio', 'Elige o agrega el comercio donde compraste.');
    setGuardando(true);
    try {
      await st.guardarFactura(apertura.facturaId, {
        comercioId,
        metodo,
        tasaBs: tasa,
        fotoUri: foto,
        vence,
        lineas: lineas.map((l) => {
          const c = calcular(l);
          return { itemId: l.itemId, cantidad: c.cantidad, totalBs: c.bs ?? 0, totalUsd: c.usd };
        }),
      });
      if (tasa && !st.tasaBs) await st.setTasa(tasa);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onCerrar();
    } catch (e) {
      setGuardando(false);
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : String(e));
    }
  };

  const eliminarFactura = () => {
    if (apertura?.facturaId == null) return;
    const id = apertura.facturaId;
    Alert.alert('Desmarcar compra', 'Los productos de esta factura vuelven a pendientes.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desmarcar',
        style: 'destructive',
        onPress: async () => {
          await st.eliminarFactura(id);
          onCerrar();
        },
      },
    ]);
  };

  const editando = apertura?.facturaId != null;
  const simbolo = moneda === 'USD' ? '$' : 'Bs.';
  const titulo =
    lineas.length === 1 && !editando ? itemDe(lineas[0].itemId)?.producto_nombre : `Factura · ${lineas.length} ${lineas.length === 1 ? 'producto' : 'productos'}`;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCerrar} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.fondo} onPress={onCerrar} accessibilityLabel="Cerrar" />
        <View style={[s.hoja, { paddingBottom: insets.bottom + 12 }]}>
          <View style={s.asa} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
            <Text style={s.titulo} numberOfLines={2}>
              {titulo}
            </Text>

            {/* Moneda y tasa */}
            <Segmentado
              opciones={[
                { valor: 'USD', etiqueta: 'Precios en $' },
                { valor: 'BS', etiqueta: 'Precios en Bs.' },
              ]}
              valor={moneda}
              onCambio={cambiarMoneda}
            />
            <View style={s.fila}>
              <Text style={s.etiquetaFila}>Tasa 1 $ =</Text>
              <TextInput
                style={[estilos.input, s.inputTasa]}
                value={tasaTxt}
                onChangeText={setTasaTxt}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={colores.borde}
                selectTextOnFocus
              />
              <Text style={s.etiquetaFila}>Bs.</Text>
            </View>
            <Segmentado
              opciones={[
                { valor: 'unitario', etiqueta: 'Precio por unidad' },
                { valor: 'total', etiqueta: 'Total del producto' },
              ]}
              valor={modoPrecio}
              onCambio={cambiarModo}
            />

            {/* Productos */}
            {lineas.map((l, idx) => {
              const item = itemDe(l.itemId);
              if (!item) return null;
              const c = calcular(l);
              const ref = referencias.get(item.producto_id);
              const unidad = item.unidad ? ` ${item.unidad}` : '';
              const refUsd = ref?.ultimo.precio_unitario_usd;
              const dif =
                ref && c.monto > 0
                  ? refUsd != null && c.unitarioUsd != null
                    ? ((c.unitarioUsd - refUsd) / refUsd) * 100
                    : c.unitarioBs != null
                      ? ((c.unitarioBs - ref.ultimo.precio_unitario_bs) / ref.ultimo.precio_unitario_bs) * 100
                      : null
                  : null;
              return (
                <View key={l.itemId} style={[estilos.tarjeta, { gap: 8 }]}>
                  <View style={s.filaEntre}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.producto} numberOfLines={2}>
                        {item.producto_nombre}
                      </Text>
                      {item.cantidad_pedida != null && (
                        <Text style={s.nota}>
                          Pedido: {formatCantidad(item.cantidad_pedida)}
                          {unidad}
                        </Text>
                      )}
                    </View>
                    {(lineas.length > 1 || editando) && (
                      <Pressable
                        hitSlop={10}
                        onPress={() => setLineas((ls) => ls.filter((x) => x.itemId !== l.itemId))}
                        accessibilityLabel={`Quitar ${item.producto_nombre} de la factura`}
                      >
                        <Icono name="close-circle" color={colores.textoSuave} />
                      </Pressable>
                    )}
                  </View>

                  <View style={s.fila}>
                    <Pressable style={s.paso} onPress={() => pasoCantidad(l, -1)} accessibilityLabel="Restar uno">
                      <Icono name="remove" size={22} />
                    </Pressable>
                    <TextInput
                      style={[estilos.input, s.inputCantidad]}
                      value={l.cantidadTxt}
                      onChangeText={(t) => actualizar(l.itemId, { cantidadTxt: t })}
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                    />
                    <Pressable style={s.paso} onPress={() => pasoCantidad(l, 1)} accessibilityLabel="Sumar uno">
                      <Icono name="add" size={22} />
                    </Pressable>
                    <View style={s.precioCaja}>
                      <Text style={s.simbolo}>{simbolo}</Text>
                      <TextInput
                        style={s.inputPrecio}
                        value={l.precioTxt}
                        onChangeText={(t) => actualizar(l.itemId, { precioTxt: t })}
                        keyboardType="decimal-pad"
                        placeholder="0,00"
                        placeholderTextColor={colores.borde}
                        autoFocus={idx === 0 && !editando}
                        selectTextOnFocus
                      />
                    </View>
                  </View>

                  {c.monto > 0 && c.cantidad > 0 && (
                    <Text style={s.calculo}>
                      {modoPrecio === 'unitario' ? 'Total ' : 'Unidad '}
                      {modoPrecio === 'unitario'
                        ? [c.usd != null && formatUsd(c.usd), c.bs != null && formatBs(c.bs)].filter(Boolean).join(' · ')
                        : [c.unitarioUsd != null && formatUsd(c.unitarioUsd), c.unitarioBs != null && formatBs(c.unitarioBs)]
                            .filter(Boolean)
                            .join(' · ')}
                    </Text>
                  )}
                  {item.cantidad_pedida != null && c.cantidad > 0 && c.cantidad !== item.cantidad_pedida && (
                    <Text style={[s.nota, { color: colores.aviso }]}>
                      {c.cantidad < item.cantidad_pedida ? 'Menos' : 'Más'} de lo pedido
                    </Text>
                  )}
                  {ref && dif != null && dif >= UMBRAL_ALERTA && (
                    <View style={s.alerta}>
                      <Icono name="warning" size={18} color={colores.peligro} />
                      <Text style={s.alertaTexto}>
                        Subió {formatNumero(dif, 0)}% desde la última vez
                        {ref.masBarato ? `. En ${ref.masBarato.comercio_nombre} estaba a ${formatPrecioRef(ref.masBarato)}` : ''}
                      </Text>
                    </View>
                  )}
                  {ref && (
                    <Pressable onPress={() => usarPrecioAnterior(l, item)} style={s.referencia}>
                      <Icono name="time-outline" size={16} color={colores.acento} />
                      <Text style={s.referenciaTexto}>
                        Último: {formatPrecioRef(ref.ultimo)} en {ref.ultimo.comercio_nombre} · {haceCuanto(ref.ultimo.fecha)}
                        {dif != null && (Math.abs(dif) < 0.5 ? '  (igual)' : `  (${dif > 0 ? '+' : ''}${formatNumero(dif, 0)}%)`)}
                      </Text>
                    </Pressable>
                  )}
                  {ref?.masBarato && (
                    <Text style={[s.nota, { color: colores.primario }]}>
                      Más barato antes: {formatPrecioRef(ref.masBarato)} en {ref.masBarato.comercio_nombre}
                    </Text>
                  )}
                </View>
              );
            })}

            {/* Agregar más productos a la misma factura */}
            {pendientesDisponibles.length > 0 &&
              (mostrarPendientes ? (
                <View style={{ gap: 6 }}>
                  <Text style={estilos.etiqueta}>Agregar a esta factura</Text>
                  <View style={s.chips}>
                    {pendientesDisponibles.map((i) => (
                      <Chip
                        key={i.id}
                        texto={i.producto_nombre}
                        icono="add"
                        activo={false}
                        onPress={() => setLineas((ls) => [...ls, nuevaLinea(i)])}
                      />
                    ))}
                  </View>
                </View>
              ) : (
                <Boton
                  titulo="Agregar otro producto a esta factura"
                  variante="secundario"
                  icono="add-circle-outline"
                  onPress={() => setMostrarPendientes(true)}
                />
              ))}

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
              <View style={s.chips}>
                {METODOS_PAGO.map((m) => (
                  <Chip key={m} texto={m} icono={ICONO_METODO[m]} activo={metodo === m} onPress={() => setMetodo(m)} />
                ))}
              </View>
              {metodo === 'Crédito' && (
                <View style={[s.credito, { gap: 8 }]}>
                  <Text style={s.creditoTexto}>
                    Queda como deuda de {formatUsd(totales.usd)} con {comercios.find((c) => c.id === comercioId)?.nombre ?? 'el comercio'}. La
                    paga el negocio; aparecerá en «Por pagar».
                  </Text>
                  <Text style={estilos.etiqueta}>Vence</Text>
                  <View style={s.chips}>
                    <Chip texto="Sin fecha" activo={vence == null} onPress={() => setVence(null)} />
                    {[7, 15, 30].map((d) => {
                      const f = sumarDias(d);
                      return <Chip key={d} texto={`${d} días`} activo={vence?.slice(0, 10) === f.slice(0, 10)} onPress={() => setVence(f)} />;
                    })}
                  </View>
                  {vence && <Text style={s.nota}>Vence el {formatFecha(vence)}</Text>}
                </View>
              )}
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
                <View style={s.fila}>
                  <Boton titulo="Cámara" variante="secundario" icono="camera-outline" onPress={() => tomarFoto('camara')} style={{ flex: 1 }} />
                  <Boton titulo="Galería" variante="secundario" icono="images-outline" onPress={() => tomarFoto('galeria')} style={{ flex: 1 }} />
                </View>
              )}
            </View>

            {editando && <Boton titulo="Desmarcar toda la factura" variante="texto" icono="arrow-undo-outline" onPress={eliminarFactura} />}
          </ScrollView>

          <View style={{ paddingTop: 10, gap: 4 }}>
            {totales.bs > 0 && (
              <Text style={s.resumen}>
                {lineas.length} {lineas.length === 1 ? 'producto' : 'productos'} · pagas {formatBs(totales.bs)}
              </Text>
            )}
            <Boton
              titulo={totales.usd > 0 || totales.bs > 0 ? `Guardar · ${moneda === 'USD' ? formatUsd(totales.usd) : formatBs(totales.bs)}` : 'Guardar'}
              icono="checkmark"
              onPress={guardar}
              deshabilitado={guardando || !lineas.length}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function nuevaLinea(item: Item | undefined): Linea {
  return { itemId: item?.id ?? 0, cantidadTxt: formatCantidad(item?.cantidad_pedida ?? 1) || '1', precioTxt: '' };
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  hoja: {
    backgroundColor: colores.fondo,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: '94%',
  },
  asa: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colores.borde, marginBottom: 10 },
  titulo: { fontSize: 22, fontWeight: '700', color: colores.texto },
  producto: { fontSize: 17, fontWeight: '700', color: colores.texto },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filaEntre: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  etiquetaFila: { fontSize: 16, fontWeight: '600', color: colores.textoSuave },
  inputTasa: { flex: 1, fontSize: 18, fontWeight: '600', minHeight: 44 },
  paso: {
    width: 44,
    height: 48,
    borderRadius: 10,
    backgroundColor: colores.fondo,
    borderWidth: 1,
    borderColor: colores.borde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputCantidad: { width: 64, minHeight: 48, textAlign: 'center', fontSize: 18, fontWeight: '600', paddingHorizontal: 4 },
  precioCaja: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: colores.primario,
    borderRadius: 12,
    paddingHorizontal: 10,
    backgroundColor: colores.superficie,
  },
  simbolo: { fontSize: 17, fontWeight: '700', color: colores.primario },
  inputPrecio: { flex: 1, fontSize: 20, fontWeight: '700', color: colores.texto, paddingVertical: 8 },
  calculo: { fontSize: 14, color: colores.texto, fontWeight: '600' },
  nota: { fontSize: 14, color: colores.textoSuave },
  credito: { padding: 12, borderRadius: 12, backgroundColor: colores.avisoSuave },
  creditoTexto: { fontSize: 14, color: colores.texto, lineHeight: 20 },
  alerta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colores.peligroSuave,
    padding: 8,
    borderRadius: 10,
  },
  alertaTexto: { flex: 1, fontSize: 14, fontWeight: '600', color: colores.peligro },
  referencia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colores.acentoSuave,
    padding: 8,
    borderRadius: 10,
  },
  referenciaTexto: { flex: 1, fontSize: 13, color: colores.acento },
  miniatura: { width: 96, height: 128, borderRadius: 10, backgroundColor: colores.borde },
  resumen: { fontSize: 14, color: colores.textoSuave, textAlign: 'center' },
});
