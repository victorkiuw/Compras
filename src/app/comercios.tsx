import { useState } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { PedirTexto } from '../components/Dialogos';
import { Boton, Chip, colores, estilos, Icono, type NombreIcono } from '../components/ui';
import * as repo from '../db/repo';
import type { Comercio } from '../db/repo';
import { agruparPorSeccion, iconoSeccion, seccionesDisponibles } from '../lib/secciones';
import { useCompraStore } from '../store/useCompraStore';

export default function Comercios() {
  const { comercios, recargarComercios } = useCompraStore();
  const [editando, setEditando] = useState<Comercio | null>(null);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('Supermercado');
  const [nuevaSeccion, setNuevaSeccion] = useState(false);
  const [plegadas, setPlegadas] = useState<Set<string>>(new Set());

  const secciones = seccionesDisponibles([...comercios.map((c) => c.tipo), tipo]);
  const grupos = agruparPorSeccion(comercios);

  const limpiar = () => {
    setEditando(null);
    setNombre('');
    setTipo('Supermercado');
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

  const alternarSeccion = (seccion: string) =>
    setPlegadas((prev) => {
      const sig = new Set(prev);
      if (sig.has(seccion)) sig.delete(seccion);
      else sig.add(seccion);
      return sig;
    });

  const eliminar = async (c: Comercio) => {
    const precios = await repo.contarPreciosComercio(c.id);
    const borrar = async () => {
      await repo.eliminarComercio(c.id);
      if (editando?.id === c.id) limpiar();
      await recargarComercios();
    };
    if (!precios) {
      return Alert.alert('Eliminar comercio', `¿Eliminar "${c.nombre}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: borrar },
      ]);
    }
    Alert.alert(
      'Eliminar comercio',
      `"${c.nombre}" tiene ${precios} ${precios === 1 ? 'precio registrado' : 'precios registrados'}. ` +
        'Si lo eliminas, esos precios también se borran del radar y del cálculo de ahorro ' +
        '(tus compras pasadas siguen en el historial). Si solo cambió de nombre, mejor edítalo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar igual', style: 'destructive', onPress: borrar },
      ],
    );
  };

  return (
    <>
      <SectionList
        sections={grupos.map((g) => ({ titulo: g.seccion, total: g.comercios.length, data: plegadas.has(g.seccion) ? [] : g.comercios }))}
        keyExtractor={(c) => String(c.id)}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ padding: 12, paddingBottom: 32, gap: 8 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={[estilos.tarjeta, { gap: 10, marginBottom: 4 }]}>
            <Text style={estilos.etiqueta}>{editando ? 'Editar comercio' : 'Nuevo comercio'}</Text>
            <TextInput
              style={estilos.input}
              placeholder="Nombre (ej. Makro)"
              placeholderTextColor={colores.textoSuave}
              value={nombre}
              onChangeText={setNombre}
            />
            <Text style={estilos.etiqueta}>Sección</Text>
            <View style={s.chips}>
              {secciones.map((t) => (
                <Chip key={t} texto={t} icono={iconoSeccion(t) as NombreIcono} activo={tipo === t} onPress={() => setTipo(t)} />
              ))}
              <Chip texto="Otra…" icono="add" activo={false} onPress={() => setNuevaSeccion(true)} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {editando && <Boton titulo="Cancelar" variante="secundario" onPress={limpiar} />}
              <Boton
                titulo={editando ? 'Guardar cambios' : 'Agregar'}
                icono="checkmark"
                onPress={guardar}
                deshabilitado={!nombre.trim()}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Pressable onPress={() => alternarSeccion(section.titulo)} style={s.seccion} accessibilityLabel={`Sección ${section.titulo}`}>
            <Icono name={iconoSeccion(section.titulo) as NombreIcono} size={18} color={colores.primario} />
            <Text style={s.seccionTexto}>
              {section.titulo} · {section.total}
            </Text>
            <Icono name={plegadas.has(section.titulo) ? 'chevron-down' : 'chevron-up'} size={18} color={colores.textoSuave} />
          </Pressable>
        )}
        renderItem={({ item }) => (
          <Pressable onPress={() => editar(item)} style={[estilos.tarjeta, s.fila, editando?.id === item.id && { borderColor: colores.primario }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.nombre}>{item.nombre}</Text>
              <Text style={s.tipo}>Toca para editar o cambiar de sección</Text>
            </View>
            <Pressable onPress={() => eliminar(item)} hitSlop={12} accessibilityLabel={`Eliminar ${item.nombre}`}>
              <Icono name="trash-outline" color={colores.peligro} size={20} />
            </Pressable>
          </Pressable>
        )}
      />
      {nuevaSeccion && (
        <PedirTexto
          titulo="Nueva sección"
          mensaje="Por ejemplo: Empaques, Agropecuaria, Distribuidora de bebidas…"
          placeholder="Nombre de la sección"
          confirmar="Usar"
          onAceptar={(t) => setTipo(t.charAt(0).toUpperCase() + t.slice(1))}
          onCerrar={() => setNuevaSeccion(false)}
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  seccion: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 2, paddingVertical: 4 },
  seccionTexto: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: colores.textoSuave,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60 },
  nombre: { fontSize: 17, fontWeight: '600', color: colores.texto },
  tipo: { fontSize: 13, color: colores.textoSuave },
});
