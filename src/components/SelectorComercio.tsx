import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Comercio } from '../db/repo';
import { agruparPorSeccion, iconoSeccion, seccionesDisponibles } from '../lib/secciones';
import { Boton, Chip, colores, estilos, Icono, type NombreIcono } from './ui';

/**
 * Elegir comercio por secciones: una barra con cada sección (Supermercado, Carnicería,
 * Farmacia…) que al tocarla despliega sus comercios.
 */
export function SelectorComercio({
  comercios,
  comercioId,
  onElegir,
  onCrear,
}: {
  comercios: Comercio[];
  comercioId: number | null;
  onElegir: (id: number) => void;
  /** Crea un comercio en la sección indicada y devuelve su id. */
  onCrear: (nombre: string, seccion: string) => Promise<number>;
}) {
  const elegido = comercios.find((c) => c.id === comercioId);
  const grupos = agruparPorSeccion(comercios);
  // Si aún no hay comercio elegido se abre la primera sección para elegir rápido.
  const [abierta, setAbierta] = useState<string | null>(elegido ? null : (grupos[0]?.seccion ?? null));
  const [otras, setOtras] = useState(false);
  const [nuevo, setNuevo] = useState<{ seccion: string; nombre: string } | null>(null);

  const vacias = seccionesDisponibles([]).filter((s) => !grupos.some((g) => g.seccion === s));

  const alternar = (seccion: string) => {
    Haptics.selectionAsync().catch(() => {});
    setNuevo(null);
    setOtras(false);
    setAbierta(abierta === seccion ? null : seccion);
  };

  const elegir = (id: number) => {
    Haptics.selectionAsync().catch(() => {});
    onElegir(id);
    setAbierta(null);
  };

  const crear = async () => {
    if (!nuevo?.nombre.trim()) return;
    const id = await onCrear(nuevo.nombre.trim(), nuevo.seccion);
    setNuevo(null);
    setOtras(false);
    elegir(id);
  };

  const formNuevo = (seccion: string) =>
    nuevo?.seccion === seccion ? (
      <View style={s.fila}>
        <TextInput
          style={[estilos.input, { flex: 1, fontSize: 16, minHeight: 46 }]}
          placeholder={`Nombre (${seccion})`}
          placeholderTextColor={colores.textoSuave}
          value={nuevo.nombre}
          onChangeText={(t) => setNuevo({ seccion, nombre: t })}
          autoFocus
          onSubmitEditing={crear}
          returnKeyType="done"
        />
        <Boton titulo="Agregar" onPress={crear} deshabilitado={!nuevo.nombre.trim()} style={{ minHeight: 46 }} />
      </View>
    ) : null;

  return (
    <View style={{ gap: 6 }}>
      <Text style={estilos.etiqueta}>Comercio</Text>

      {/* Comercio elegido (tocar para cambiarlo) */}
      <Pressable
        onPress={() => setAbierta(abierta ? null : (elegido?.tipo ?? grupos[0]?.seccion ?? null))}
        style={[s.elegido, !elegido && { borderColor: colores.aviso }]}
      >
        <Icono name={(elegido ? iconoSeccion(elegido.tipo) : 'storefront-outline') as NombreIcono} color={elegido ? colores.primario : colores.aviso} />
        <View style={{ flex: 1 }}>
          <Text style={s.elegidoNombre}>{elegido?.nombre ?? 'Elige dónde compraste'}</Text>
          {elegido && <Text style={s.meta}>{elegido.tipo}</Text>}
        </View>
        <Text style={s.cambiar}>{abierta ? 'Cerrar' : 'Cambiar'}</Text>
      </Pressable>

      {/* Barra de secciones */}
      {(abierta !== null || !elegido || otras) && (
        <View style={s.lista}>
          {grupos.map((g) => {
            const abiertaEsta = abierta === g.seccion;
            const contiene = g.comercios.some((c) => c.id === comercioId);
            return (
              <View key={g.seccion} style={[s.seccion, abiertaEsta && s.seccionAbierta]}>
                <Pressable onPress={() => alternar(g.seccion)} style={s.cabecera} accessibilityLabel={`Sección ${g.seccion}`}>
                  <View style={[s.icono, abiertaEsta && { backgroundColor: colores.primario }]}>
                    <Icono name={iconoSeccion(g.seccion) as NombreIcono} size={18} color={abiertaEsta ? '#fff' : colores.primario} />
                  </View>
                  <Text style={[s.seccionNombre, contiene && { color: colores.primario }]}>{g.seccion}</Text>
                  <Text style={s.meta}>{g.comercios.length}</Text>
                  <Icono name={abiertaEsta ? 'chevron-up' : 'chevron-down'} size={18} color={colores.textoSuave} />
                </Pressable>
                {abiertaEsta && (
                  <View style={s.contenido}>
                    <View style={s.chips}>
                      {g.comercios.map((c) => (
                        <Chip key={c.id} texto={c.nombre} activo={c.id === comercioId} onPress={() => elegir(c.id)} />
                      ))}
                      {nuevo?.seccion !== g.seccion && (
                        <Chip texto="Nuevo" icono="add" activo={false} onPress={() => setNuevo({ seccion: g.seccion, nombre: '' })} />
                      )}
                    </View>
                    {formNuevo(g.seccion)}
                  </View>
                )}
              </View>
            );
          })}

          {/* Secciones sin comercios todavía */}
          <View style={[s.seccion, otras && s.seccionAbierta]}>
            <Pressable
              onPress={() => {
                setAbierta(null);
                setNuevo(null);
                setOtras(!otras);
              }}
              style={s.cabecera}
            >
              <View style={s.icono}>
                <Icono name="add" size={18} color={colores.acento} />
              </View>
              <Text style={[s.seccionNombre, { color: colores.acento }]}>Comercio de otra sección</Text>
              <Icono name={otras ? 'chevron-up' : 'chevron-down'} size={18} color={colores.textoSuave} />
            </Pressable>
            {otras && (
              <View style={s.contenido}>
                <View style={s.chips}>
                  {vacias.map((sec) => (
                    <Chip
                      key={sec}
                      texto={sec}
                      icono={iconoSeccion(sec) as NombreIcono}
                      activo={nuevo?.seccion === sec}
                      onPress={() => setNuevo({ seccion: sec, nombre: '' })}
                    />
                  ))}
                </View>
                {nuevo && vacias.includes(nuevo.seccion) && formNuevo(nuevo.seccion)}
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  elegido: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 54,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colores.primario,
    backgroundColor: colores.superficie,
  },
  elegidoNombre: { fontSize: 17, fontWeight: '700', color: colores.texto },
  cambiar: { fontSize: 14, fontWeight: '700', color: colores.acento },
  lista: { gap: 6 },
  seccion: { borderRadius: 12, backgroundColor: colores.superficie, borderWidth: 1, borderColor: colores.borde },
  seccionAbierta: { borderColor: colores.primario },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 10 },
  icono: { width: 32, height: 32, borderRadius: 16, backgroundColor: colores.primarioSuave, alignItems: 'center', justifyContent: 'center' },
  seccionNombre: { flex: 1, fontSize: 16, fontWeight: '600', color: colores.texto },
  meta: { fontSize: 13, color: colores.textoSuave },
  contenido: { gap: 10, paddingHorizontal: 10, paddingBottom: 12 },
});
