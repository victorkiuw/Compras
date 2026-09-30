import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, SectionList, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MenuOpciones, PedirTexto, type Opcion } from '../../components/Dialogos';
import { EditorProducto } from '../../components/EditorProducto';
import { FacturaSheet, type AperturaFactura } from '../../components/FacturaSheet';
import { TasaModal } from '../../components/TasaModal';
import { Boton, colores, estilos, Icono, Segmentado, Vacio } from '../../components/ui';
import * as repo from '../../db/repo';
import type { Factura, Item, ReferenciaPrecio, SugerenciaProducto } from '../../db/repo';
import { diasDesde, formatBs, formatCantidad, formatFecha, formatTasa, formatUsd, haceCuanto } from '../../lib/format';
import { parseLinea } from '../../lib/parser';
import { bsHoy, formatPrecioRef } from '../../lib/precios';
import { textoLista, textoResumen } from '../../lib/resumen';
import { totalGastado, useCompraStore } from '../../store/useCompraStore';

type Pestana = 'pendientes' | 'comprados';
type Vista = 'lista' | 'comercio';

interface Seccion {
  titulo: string | null;
  tipo: 'pendiente' | 'nohabia' | 'factura';
  data: (Item | Factura)[];
}

const DIAS_RECORDATORIO_RESPALDO = 7;

export default function ModoCompra() {
  const insets = useSafeAreaInsets();
  const st = useCompraStore();
  const { lista, items, facturas, referencias, tasaBs, tasaFecha, tasaOrigen, tasaTipo, actualizandoTasa, tasaSinConexion } = st;
  const { actualizarTasa, recargar, eliminarItems, cerrar, editarItem, marcarNoHabia, agregarTexto } = st;
  const [pestana, setPestana] = useState<Pestana>('pendientes');
  const [vista, setVista] = useState<Vista>('lista');
  const [apertura, setApertura] = useState<AperturaFactura | null>(null);
  const [editando, setEditando] = useState<Item | null>(null);
  const [seleccion, setSeleccion] = useState<Set<number> | null>(null);
  const [nuevoTexto, setNuevoTexto] = useState('');
  const [sugerencias, setSugerencias] = useState<SugerenciaProducto[]>([]);
  const [editandoTasa, setEditandoTasa] = useState(false);
  const [menu, setMenu] = useState(false);
  const [nombrarPlantilla, setNombrarPlantilla] = useState(false);

  useFocusEffect(
    useCallback(() => {
      recargar();
      actualizarTasa();
    }, [recargar, actualizarTasa]),
  );

  // Autocompletado del campo "Agregar producto".
  useEffect(() => {
    const nombre = parseLinea(nuevoTexto)?.nombre ?? '';
    if (nombre.length < 2) return;
    let vigente = true;
    const t = setTimeout(() => {
      repo.sugerirProductos(nombre, 4).then((r) => vigente && setSugerencias(r));
    }, 200);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [nuevoTexto]);

  const pendientes = useMemo(() => items.filter((i) => !i.comprado && !i.no_disponible), [items]);
  const noHabia = useMemo(() => items.filter((i) => !i.comprado && i.no_disponible), [items]);
  const comprados = items.filter((i) => i.comprado).length;
  const total = totalGastado(items);
  const progreso = items.length ? (comprados + noHabia.length) / items.length : 0;

  const tasaEsDeHoy = !!tasaFecha && haceCuanto(tasaFecha) === 'hoy';
  const colorTasa = tasaEsDeHoy || actualizandoTasa ? colores.acento : colores.aviso;
  const etiquetaTasa = tasaOrigen === 'manual' ? 'Tasa manual' : tasaTipo === 'oficial' ? 'BCV' : 'Paralelo';
  const textoTasa =
    actualizandoTasa && !tasaBs
      ? 'Buscando la tasa del día…'
      : !tasaBs
        ? tasaSinConexion
          ? 'Sin conexión: toca para escribir la tasa'
          : 'Toca para fijar la tasa (Bs por $)'
        : `${etiquetaTasa}: ${formatTasa(tasaBs)}${tasaEsDeHoy ? ' · hoy' : ` · ${haceCuanto(tasaFecha!)}${tasaSinConexion ? ', sin conexión' : ''}`}`;

  const diasSinRespaldo = st.ultimoRespaldo ? diasDesde(st.ultimoRespaldo) : null;
  const recordarRespaldo = items.length > 0 && (diasSinRespaldo == null || diasSinRespaldo >= DIAS_RECORDATORIO_RESPALDO);

  const secciones: Seccion[] = useMemo(() => {
    if (pestana === 'comprados') return [{ titulo: null, tipo: 'factura', data: facturas }];
    const base: Seccion[] = [];
    if (vista === 'lista') {
      base.push({ titulo: null, tipo: 'pendiente', data: pendientes });
    } else {
      // Agrupa por el comercio donde estuvo más barato (o el último conocido).
      const grupos = new Map<string, Item[]>();
      for (const i of pendientes) {
        const ref = referencias.get(i.producto_id);
        const clave = (ref?.masBarato ?? ref?.ultimo)?.comercio_nombre ?? 'Sin precio anterior';
        grupos.set(clave, [...(grupos.get(clave) ?? []), i]);
      }
      const orden = [...grupos.entries()].sort((a, b) =>
        a[0] === 'Sin precio anterior' ? 1 : b[0] === 'Sin precio anterior' ? -1 : b[1].length - a[1].length,
      );
      for (const [titulo, data] of orden) base.push({ titulo, tipo: 'pendiente', data });
    }
    if (noHabia.length) base.push({ titulo: `No había (${noHabia.length})`, tipo: 'nohabia', data: noHabia });
    return base;
  }, [pestana, vista, pendientes, noHabia, facturas, referencias]);

  const cambiarTextoNuevo = (t: string) => {
    setNuevoTexto(t);
    if ((parseLinea(t)?.nombre ?? '').length < 2) setSugerencias([]);
  };

  const agregarRapido = async (sugerencia?: SugerenciaProducto) => {
    const parseado = parseLinea(nuevoTexto);
    if (!parseado) return;
    if (sugerencia) {
      parseado.nombre = sugerencia.nombre;
      parseado.unidad = parseado.unidad ?? sugerencia.unidad;
    }
    await agregarTexto([parseado]);
    setNuevoTexto('');
    setSugerencias([]);
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

  const idsSeleccion = () => pendientes.filter((i) => seleccion?.has(i.id)).map((i) => i.id);

  const registrarSeleccion = () => {
    setApertura({ facturaId: null, itemIds: idsSeleccion() });
    setSeleccion(null);
  };

  const noHabiaSeleccion = async () => {
    await marcarNoHabia(idsSeleccion(), true);
    setSeleccion(null);
  };

  const eliminarSeleccion = () => {
    const ids = idsSeleccion();
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

  const resumenActual = () => (lista ? textoResumen(lista.fecha, items, facturas) : '');
  const compartirResumen = (texto = resumenActual()) => {
    if (texto) Share.share({ message: texto }).catch(() => {});
  };

  const cerrarCompra = () => {
    const faltan = pendientes.length + noHabia.length;
    const cerrarY = (mover: boolean) => async () => {
      const texto = resumenActual();
      await cerrar(mover);
      Alert.alert('Compra cerrada', '¿Quieres enviar el resumen por WhatsApp?', [
        { text: 'Ahora no', style: 'cancel' },
        { text: 'Enviar resumen', onPress: () => compartirResumen(texto) },
      ]);
    };
    const botones: Parameters<typeof Alert.alert>[2] = [{ text: 'Cancelar', style: 'cancel' }];
    if (faltan) {
      botones.push({ text: `Cerrar y pasar ${faltan} a una lista nueva`, onPress: cerrarY(true) });
      botones.push({ text: 'Cerrar sin pasarlos', style: 'destructive', onPress: cerrarY(false) });
    } else {
      botones.push({ text: 'Cerrar compra', onPress: cerrarY(false) });
    }
    const totalTxt = `Pagado: ${formatBs(total.bs)}${total.usd ? ` (${formatUsd(total.usd)})` : ''}${
      total.creditoUsd ? `\nA crédito: ${formatUsd(total.creditoUsd)}` : ''
    }`;
    Alert.alert(
      'Cerrar compra',
      `${totalTxt}\n${comprados} de ${items.length} productos comprados${noHabia.length ? `, ${noHabia.length} no había` : ''}.`,
      botones,
    );
  };

  const opcionesMenu: Opcion[] = [
    { titulo: 'Enviar resumen por WhatsApp', icono: 'share-social-outline', onPress: () => compartirResumen() },
    { titulo: 'Guardar como lista frecuente', icono: 'bookmark-outline', onPress: () => setNombrarPlantilla(true) },
    { titulo: 'Cerrar compra', icono: 'lock-closed-outline', onPress: cerrarCompra },
  ];

  const pie = (
    <View style={{ gap: 8, marginTop: 8 }}>
      {pestana === 'pendientes' && (
        <>
          {sugerencias.map((p) => (
            <Pressable key={p.id} onPress={() => agregarRapido(p)} style={s.sugerencia}>
              <Icono name="add" size={18} color={colores.acento} />
              <Text style={s.sugerenciaTexto} numberOfLines={1}>
                {p.nombre}
                {p.unidad ? ` · ${p.unidad}` : ''}
                {p.precio_usd != null ? ` · último ${formatUsd(p.precio_usd)}` : ''}
                {p.comercio_nombre ? ` (${p.comercio_nombre})` : ''}
              </Text>
            </Pressable>
          ))}
          <View style={s.agregar}>
            <Icono name="add-circle-outline" color={colores.textoSuave} />
            <TextInput
              style={s.agregarInput}
              placeholder="Agregar producto (ej. 2 kg de queso)"
              placeholderTextColor={colores.textoSuave}
              value={nuevoTexto}
              onChangeText={cambiarTextoNuevo}
              onSubmitEditing={() => agregarRapido()}
              returnKeyType="done"
              submitBehavior="submit"
            />
          </View>
        </>
      )}
      {items.length > 0 && (
        <Boton titulo="Cerrar compra" variante="secundario" icono="lock-closed-outline" onPress={cerrarCompra} style={{ marginTop: 4 }} />
      )}
    </View>
  );

  return (
    <View style={[s.pantalla, { paddingTop: insets.top }]}>
      {/* Encabezado: fecha, progreso, totales y tasa */}
      <View style={s.encabezado}>
        <View style={s.filaEntre}>
          <View style={{ flexShrink: 1 }}>
            <Text style={s.fecha}>{formatFecha(lista?.fecha ?? new Date().toISOString())}</Text>
            <Text style={s.progresoTexto}>
              {comprados}/{items.length} comprados{noHabia.length ? ` · ${noHabia.length} no había` : ''}
            </Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={s.total}>{formatBs(total.bs)}</Text>
            {total.usd > 0 && <Text style={s.totalUsd}>{formatUsd(total.usd)}</Text>}
            {total.creditoUsd > 0 && <Text style={s.totalCredito}>+ {formatUsd(total.creditoUsd)} a crédito</Text>}
          </View>
          {lista && (
            <Pressable onPress={() => setMenu(true)} hitSlop={12} accessibilityLabel="Más opciones" style={{ paddingTop: 2 }}>
              <Icono name="ellipsis-vertical" size={24} />
            </Pressable>
          )}
        </View>
        <View style={s.barra}>
          <View style={[s.barraRelleno, { width: `${progreso * 100}%` }]} />
        </View>
        <View style={[s.tasa, !tasaEsDeHoy && !actualizandoTasa && { backgroundColor: colores.avisoSuave }]}>
          <Pressable onPress={() => setEditandoTasa(true)} style={s.tasaInfo} accessibilityLabel="Ver o cambiar la tasa del día">
            <Icono name="swap-horizontal" size={18} color={colorTasa} />
            <Text style={[s.tasaTexto, { color: colorTasa }]} numberOfLines={1}>
              {textoTasa}
            </Text>
          </Pressable>
          {actualizandoTasa ? (
            <ActivityIndicator size="small" color={colores.acento} />
          ) : (
            <Pressable onPress={() => actualizarTasa(true)} hitSlop={10} accessibilityLabel="Actualizar tasa">
              <Icono name="refresh" size={20} color={colorTasa} />
            </Pressable>
          )}
        </View>
        {recordarRespaldo && (
          <Pressable onPress={() => router.push('/respaldo')} style={s.respaldo}>
            <Icono name="cloud-upload-outline" size={18} color={colores.aviso} />
            <Text style={s.respaldoTexto}>
              {diasSinRespaldo == null ? 'Aún no has hecho un respaldo de tus datos.' : `Último respaldo hace ${diasSinRespaldo} días.`} Toca
              para hacerlo.
            </Text>
          </Pressable>
        )}
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
      ) : (
        <SectionList
          sections={secciones.filter((x) => x.data.length > 0)}
          keyExtractor={(x) => String(x.id)}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ padding: 12, paddingBottom: 120 }}
          ItemSeparatorComponent={Separador}
          ListHeaderComponent={
            pestana === 'pendientes' && pendientes.length > 0 ? (
              <View style={s.filaVista}>
                <Text style={s.ayuda}>{seleccion ? `${seleccion.size} elegidos` : 'Mantén presionado para elegir varios'}</Text>
                <Pressable
                  onPress={() => setVista(vista === 'lista' ? 'comercio' : 'lista')}
                  style={s.botonVista}
                  accessibilityLabel="Cambiar agrupación"
                >
                  <Icono name={vista === 'lista' ? 'storefront-outline' : 'list-outline'} size={16} color={colores.acento} />
                  <Text style={s.botonVistaTexto}>{vista === 'lista' ? 'Por comercio' : 'Como lista'}</Text>
                </Pressable>
              </View>
            ) : null
          }
          renderSectionHeader={({ section }) =>
            section.titulo ? (
              <Text style={[s.seccion, section.tipo === 'nohabia' && { color: colores.peligro }]}>
                {section.tipo === 'pendiente' ? `${section.titulo} · ${section.data.length}` : section.titulo}
              </Text>
            ) : null
          }
          renderItem={({ item, section }) =>
            section.tipo === 'factura' ? (
              <TarjetaFactura
                factura={item as Factura}
                items={items.filter((i) => i.factura_id === item.id)}
                onPress={() => setApertura({ facturaId: item.id, itemIds: [] })}
              />
            ) : section.tipo === 'nohabia' ? (
              <FilaNoHabia item={item as Item} onDeshacer={() => marcarNoHabia([item.id], false)} onEditar={() => setEditando(item as Item)} />
            ) : (
              <FilaPendiente
                item={item as Item}
                referencia={referencias.get((item as Item).producto_id)}
                tasa={tasaBs}
                seleccionado={seleccion?.has(item.id) ?? (seleccion ? false : null)}
                onPress={() => tocarPendiente(item as Item)}
                onLongPress={() => mantenerPendiente(item as Item)}
                onEditar={() => setEditando(item as Item)}
              />
            )
          }
          ListEmptyComponent={
            pestana === 'pendientes' ? (
              <Vacio icono="checkmark-done-circle-outline" titulo="¡Todo listo!" texto={`Pagado: ${formatBs(total.bs)}`}>
                <Boton titulo="Cerrar compra" icono="lock-closed-outline" onPress={cerrarCompra} />
              </Vacio>
            ) : (
              <Vacio icono="basket-outline" titulo="Aún no has marcado productos" texto="Toca un producto pendiente para registrarlo." />
            )
          }
          ListFooterComponent={pie}
          SectionSeparatorComponent={Separador}
        />
      )}

      {seleccion ? (
        <View style={[s.barraSeleccion, { paddingBottom: 12 }]}>
          <Pressable onPress={() => setSeleccion(null)} hitSlop={10} accessibilityLabel="Cancelar selección">
            <Icono name="close" size={26} />
          </Pressable>
          <Boton titulo="" icono="trash-outline" variante="secundario" onPress={eliminarSeleccion} style={{ paddingHorizontal: 14 }} />
          <Boton titulo="No había" icono="close-circle-outline" variante="secundario" onPress={noHabiaSeleccion} style={{ paddingHorizontal: 12 }} />
          <Boton titulo={`Factura (${seleccion.size})`} icono="receipt-outline" onPress={registrarSeleccion} style={{ flex: 1 }} />
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
      <TasaModal visible={editandoTasa} onCerrar={() => setEditandoTasa(false)} />
      {editando && (
        <EditorProducto
          titulo="Editar producto"
          inicial={{ nombre: editando.producto_nombre, cantidad: editando.cantidad_pedida, unidad: editando.unidad, nota: editando.nota }}
          acciones={[
            editando.no_disponible
              ? {
                  titulo: 'Volver a pendiente',
                  icono: 'arrow-undo-outline',
                  onPress: () => marcarNoHabia([editando.id], false).then(() => setEditando(null)),
                }
              : {
                  titulo: 'No había',
                  icono: 'close-circle-outline',
                  onPress: () => marcarNoHabia([editando.id], true).then(() => setEditando(null)),
                },
            {
              titulo: 'Eliminar de la lista',
              icono: 'trash-outline',
              peligro: true,
              onPress: () => eliminarItems([editando.id]).then(() => setEditando(null)),
            },
          ]}
          onGuardar={async (c) => {
            await editarItem(editando.id, c);
            setEditando(null);
          }}
          onCerrar={() => setEditando(null)}
        />
      )}
      {menu && <MenuOpciones titulo="Compra actual" opciones={opcionesMenu} onCerrar={() => setMenu(false)} />}
      {nombrarPlantilla && (
        <PedirTexto
          titulo="Guardar como lista frecuente"
          mensaje="La podrás volver a usar desde «Pegar lista» sin copiarla de WhatsApp."
          placeholder="Ej. Pedido semanal"
          onAceptar={async (nombre) => {
            await repo.guardarPlantilla(nombre, textoLista(items));
            Alert.alert('Lista guardada', `«${nombre}» está en «Pegar lista» → Listas frecuentes.`);
          }}
          onCerrar={() => setNombrarPlantilla(false)}
        />
      )}
    </View>
  );
}

function Separador() {
  return <View style={{ height: 8 }} />;
}

function FilaPendiente({
  item,
  referencia,
  tasa,
  seleccionado,
  onPress,
  onLongPress,
  onEditar,
}: {
  item: Item;
  referencia?: ReferenciaPrecio;
  tasa: number | null;
  /** null = no se está seleccionando */
  seleccionado: boolean | null;
  onPress: () => void;
  onLongPress: () => void;
  onEditar: () => void;
}) {
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
        <Text style={s.nombre} numberOfLines={2}>
          {item.producto_nombre}
        </Text>
        <Pressable onPress={onEditar} hitSlop={6} style={s.cantidadFila}>
          {item.cantidad_pedida != null || item.unidad ? (
            <Text style={s.cantidad}>
              {item.cantidad_pedida != null ? formatCantidad(item.cantidad_pedida) : '—'} {item.unidad ?? ''}
            </Text>
          ) : null}
          {!item.unidad && (
            <View style={s.chipUnidad}>
              <Text style={s.chipUnidadTexto}>Elegir unidad</Text>
            </View>
          )}
        </Pressable>
        {item.nota ? <Text style={s.nota}>📝 {item.nota}</Text> : null}
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
      {seleccionado === null && (
        <Pressable onPress={onEditar} hitSlop={12} style={s.lapiz} accessibilityLabel={`Editar ${item.producto_nombre}`}>
          <Icono name="create-outline" size={22} color={colores.acento} />
        </Pressable>
      )}
    </Pressable>
  );
}

function FilaNoHabia({ item, onDeshacer, onEditar }: { item: Item; onDeshacer: () => void; onEditar: () => void }) {
  return (
    <Pressable
      onPress={onEditar}
      style={[estilos.tarjeta, s.fila, { minHeight: 52, backgroundColor: colores.peligroSuave, borderColor: colores.peligroSuave }]}
    >
      <Icono name="close-circle" size={26} color={colores.peligro} />
      <Text style={[s.nombre, { color: colores.textoSuave }]} numberOfLines={1}>
        {item.producto_nombre}
        {item.cantidad_pedida != null ? ` · ${formatCantidad(item.cantidad_pedida)}${item.unidad ? ` ${item.unidad}` : ''}` : ''}
      </Text>
      <Boton titulo="Deshacer" variante="texto" onPress={onDeshacer} style={{ minHeight: 40, paddingHorizontal: 8 }} />
    </Pressable>
  );
}

function TarjetaFactura({ factura, items, onPress }: { factura: Factura; items: Item[]; onPress: () => void }) {
  const hora = new Date(factura.fecha);
  const credito = factura.metodo_pago === 'Crédito';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        estilos.tarjeta,
        { gap: 8 },
        credito && { borderColor: colores.aviso, borderWidth: 1 },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={s.filaEntre}>
        <View style={{ flex: 1 }}>
          <Text style={s.facturaComercio}>{factura.comercio_nombre ?? 'Sin comercio'}</Text>
          <Text style={s.detalle}>
            {String(hora.getHours()).padStart(2, '0')}:{String(hora.getMinutes()).padStart(2, '0')} ·{' '}
            <Text style={credito ? { color: colores.aviso, fontWeight: '700' } : undefined}>{factura.metodo_pago}</Text>
            {credito
              ? ` · vence ${factura.vence ? formatFecha(factura.vence) : 'sin fecha'}`
              : factura.tasa_bs
                ? ` · ${formatTasa(factura.tasa_bs)}`
                : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {credito ? (
            <Text style={[s.precio, { color: colores.aviso }]}>{formatUsd(factura.total_usd)}</Text>
          ) : (
            <>
              <Text style={s.precio}>{formatBs(factura.total_bs)}</Text>
              {factura.total_usd != null && <Text style={s.detalle}>{formatUsd(factura.total_usd)}</Text>}
            </>
          )}
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
  totalCredito: { fontSize: 13, fontWeight: '700', color: colores.aviso },
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
  tasaInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
  tasaTexto: { flex: 1, fontSize: 15, fontWeight: '600', color: colores.acento },
  respaldo: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, backgroundColor: colores.avisoSuave },
  respaldoTexto: { flex: 1, fontSize: 14, color: colores.aviso, fontWeight: '600' },
  filaVista: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 },
  ayuda: { flex: 1, fontSize: 13, color: colores.textoSuave },
  botonVista: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: colores.acentoSuave,
  },
  botonVistaTexto: { fontSize: 13, fontWeight: '700', color: colores.acento },
  seccion: {
    fontSize: 14,
    fontWeight: '800',
    color: colores.textoSuave,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 8,
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  nombre: { flex: 1, fontSize: 17, fontWeight: '600', color: colores.texto },
  cantidadFila: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  cantidad: { fontSize: 16, fontWeight: '700', color: colores.texto },
  chipUnidad: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, backgroundColor: colores.avisoSuave },
  chipUnidadTexto: { fontSize: 13, fontWeight: '700', color: colores.aviso },
  nota: { fontSize: 14, color: colores.textoSuave, fontStyle: 'italic' },
  lapiz: { padding: 6, borderRadius: 20, backgroundColor: colores.acentoSuave },
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
  sugerencia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colores.acentoSuave,
  },
  sugerenciaTexto: { flex: 1, fontSize: 15, color: colores.acento, fontWeight: '600' },
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
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    backgroundColor: colores.superficie,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colores.borde,
    elevation: 8,
  },
});
