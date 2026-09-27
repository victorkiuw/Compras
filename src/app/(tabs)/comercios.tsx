import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Boton, Chip, colores, estilos, Icono } from '../../components/ui';
import * as repo from '../../db/repo';
import type { Comercio, TipoComercio } from '../../db/repo';
import { useCompraStore } from '../../store/useCompraStore';

const TIPOS: TipoComercio[] = ['Mayorista', 'Supermercado', 'Otro'];

export default function Comercios() {
  const { comercios, recargarComercios } = useCompraStore();
  const [editando, setEditando] = useState<Comercio | null>(null);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<TipoComercio>('Mayorista');

  const limpiar = () => {
    setEditando(null);
    setNombre('');
    setTipo('Mayorista');
  };

  const guardar = async () => {
    if (!nombre.trim()) return;
    if (editando) await repo.actualizarComercio(editando.id, nombre, tipo);
    else await repo.crearComercio(nombre, tipo);
    limpiar();
    await recargarComercios();
  };

  const editar = (c: Comercio) => {
    setEditando(c);
    setNombre(c.nombre);
    setTipo(c.tipo);
  };

  const eliminar = (c: Comercio) =>
    Alert.alert('Eliminar comercio', `¿Eliminar "${c.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const ok = await repo.eliminarComercio(c.id);
          if (!ok) Alert.alert('No se puede eliminar', 'Este comercio tiene precios registrados. Puedes cambiarle el nombre.');
          await recargarComercios();
        },
      },
    ]);

  return (
    <FlatList
      data={comercios}
      keyExtractor={(c) => String(c.id)}
      contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={[estilos.tarjeta, { gap: 10, marginBottom: 8 }]}>
          <Text style={estilos.etiqueta}>{editando ? 'Editar comercio' : 'Nuevo comercio'}</Text>
          <TextInput style={estilos.input} placeholder="Nombre (ej. Makro)" placeholderTextColor={colores.textoSuave} value={nombre} onChangeText={setNombre} />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {TIPOS.map((t) => (
              <Chip key={t} texto={t} activo={tipo === t} onPress={() => setTipo(t)} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {editando && <Boton titulo="Cancelar" variante="secundario" onPress={limpiar} />}
            <Boton titulo={editando ? 'Guardar cambios' : 'Agregar'} icono="checkmark" onPress={guardar} deshabilitado={!nombre.trim()} style={{ flex: 1 }} />
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => editar(item)} style={[estilos.tarjeta, s.fila]}>
          <Icono name={item.tipo === 'Mayorista' ? 'business-outline' : 'storefront-outline'} color={colores.textoSuave} />
          <View style={{ flex: 1 }}>
            <Text style={s.nombre}>{item.nombre}</Text>
            <Text style={s.tipo}>{item.tipo}</Text>
          </View>
          <Pressable onPress={() => eliminar(item)} hitSlop={12} accessibilityLabel={`Eliminar ${item.nombre}`}>
            <Icono name="trash-outline" color={colores.peligro} size={20} />
          </Pressable>
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60 },
  nombre: { fontSize: 17, fontWeight: '600', color: colores.texto },
  tipo: { fontSize: 13, color: colores.textoSuave },
});
