import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colores, estilos, Icono, Vacio } from '../../components/ui';
import * as repo from '../../db/repo';
import type { ProductoRadar } from '../../db/repo';
import { formatBs, formatNumero, haceCuanto } from '../../lib/format';
import { bsHoy, formatPrecioRef } from '../../lib/precios';
import { useCompraStore } from '../../store/useCompraStore';

export default function Radar() {
  const tasa = useCompraStore((s) => s.tasaBs);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<ProductoRadar[]>([]);
  const busquedaRef = useRef(busqueda);
  useEffect(() => {
    busquedaRef.current = busqueda;
  }, [busqueda]);

  const buscar = useCallback(async (texto: string) => {
    setResultados(await repo.buscarPrecios(texto));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => buscar(busqueda), 200);
    return () => clearTimeout(t);
  }, [busqueda, buscar]);

  // Al volver a la pestaña se refresca por si hubo compras nuevas.
  useFocusEffect(
    useCallback(() => {
      buscar(busquedaRef.current);
    }, [buscar]),
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={s.buscador}>
        <Icono name="search" color={colores.textoSuave} />
        <TextInput
          style={s.buscadorInput}
          placeholder="Buscar producto (harina, queso…)"
          placeholderTextColor={colores.textoSuave}
          value={busqueda}
          onChangeText={setBusqueda}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>
      <FlatList
        data={resultados}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <TarjetaProducto producto={item} tasa={tasa} />}
        ListEmptyComponent={
          <Vacio
            icono="pricetags-outline"
            titulo={busqueda ? 'Sin resultados' : 'Todavía no hay precios'}
            texto={busqueda ? 'No hay precios registrados para esa búsqueda.' : 'Los precios se guardan solos cada vez que marcas un producto como comprado.'}
          />
        }
      />
    </View>
  );
}

function TarjetaProducto({ producto, tasa }: { producto: ProductoRadar; tasa: number | null }) {
  const mejor = producto.precios[0];
  const peor = producto.precios[producto.precios.length - 1];
  const ahorro =
    producto.precios.length > 1 && mejor.precio_unitario_usd != null && peor.precio_unitario_usd != null
      ? ((peor.precio_unitario_usd - mejor.precio_unitario_usd) / peor.precio_unitario_usd) * 100
      : 0;
  const unidad = producto.unidad ?? mejor?.unidad;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/producto/[id]', params: { id: String(producto.id) } })}
      style={({ pressed }) => [estilos.tarjeta, { gap: 10 }, pressed && { opacity: 0.85 }]}
    >
      <View style={s.filaEntre}>
        <Text style={s.nombre}>{producto.nombre}</Text>
        <Text style={s.verMas}>Ver ahorro</Text>
        <Icono name="chevron-forward" color={colores.acento} size={18} />
      </View>

      {producto.precios.map((p, i) => {
        const hoy = bsHoy(p, tasa);
        return (
          <View key={p.comercio_id} style={[s.precioFila, i === 0 && s.mejor]}>
            <View style={{ flex: 1 }}>
              <View style={s.fila}>
                {i === 0 && producto.precios.length > 1 && <Icono name="trophy" size={16} color={colores.primario} />}
                <Text style={[s.comercio, i === 0 && { color: colores.primario }]}>{p.comercio_nombre}</Text>
              </View>
              <Text style={s.meta}>
                {haceCuanto(p.fecha)} · {p.registros} {p.registros === 1 ? 'compra' : 'compras'}
                {p.minimo_usd != null && p.precio_unitario_usd != null && p.minimo_usd < p.precio_unitario_usd
                  ? ` · mín. ${formatPrecioRef({ precio_unitario_usd: p.minimo_usd, precio_unitario_bs: 0 })}`
                  : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[s.precio, i === 0 && { color: colores.primario }]}>
                {formatPrecioRef(p)}
                {unidad ? <Text style={s.unidad}>/{unidad}</Text> : null}
              </Text>
              {hoy != null && <Text style={s.meta}>≈ {formatBs(hoy)} hoy</Text>}
            </View>
          </View>
        );
      })}

      {ahorro >= 1 && (
        <Text style={s.ahorro}>
          En {mejor.comercio_nombre} está ~{formatNumero(ahorro, 0)}% más barato que en {peor.comercio_nombre}
        </Text>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 12,
    marginBottom: 0,
    paddingHorizontal: 14,
    backgroundColor: colores.superficie,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  buscadorInput: { flex: 1, minHeight: 52, fontSize: 17, color: colores.texto },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  nombre: { flex: 1, fontSize: 18, fontWeight: '700', color: colores.texto },
  verMas: { fontSize: 14, fontWeight: '600', color: colores.acento },
  precioFila: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, backgroundColor: colores.fondo },
  mejor: { backgroundColor: colores.primarioSuave },
  comercio: { fontSize: 16, fontWeight: '600', color: colores.texto },
  meta: { fontSize: 13, color: colores.textoSuave },
  precio: { fontSize: 17, fontWeight: '700', color: colores.texto },
  unidad: { fontSize: 13, fontWeight: '500', color: colores.textoSuave },
  ahorro: { fontSize: 13, color: colores.primario, fontWeight: '600' },
});
