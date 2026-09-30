import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

export const colores = {
  fondo: '#F3F5F7',
  superficie: '#FFFFFF',
  texto: '#1B1F24',
  textoSuave: '#5F6B7A',
  borde: '#DDE2E8',
  primario: '#0B7A55',
  primarioSuave: '#E3F4EC',
  acento: '#1565C0',
  acentoSuave: '#E6EFFB',
  peligro: '#C62828',
  peligroSuave: '#FDECEC',
  aviso: '#A15C00',
  avisoSuave: '#FFF3E0',
};

export type NombreIcono = ComponentProps<typeof Ionicons>['name'];

export function Icono(props: { name: NombreIcono; size?: number; color?: string }) {
  return <Ionicons size={props.size ?? 22} color={props.color ?? colores.texto} name={props.name} />;
}

type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'texto';

export function Boton({
  titulo,
  onPress,
  variante = 'primario',
  icono,
  deshabilitado,
  style,
}: {
  titulo: string;
  onPress: () => void;
  variante?: VarianteBoton;
  icono?: NombreIcono;
  deshabilitado?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const fondo = {
    primario: colores.primario,
    secundario: colores.superficie,
    peligro: colores.peligro,
    texto: 'transparent',
  }[variante];
  const colorTexto = variante === 'primario' || variante === 'peligro' ? '#fff' : variante === 'texto' ? colores.acento : colores.texto;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={deshabilitado}
      style={({ pressed }) => [
        estilos.boton,
        { backgroundColor: fondo, opacity: deshabilitado ? 0.45 : pressed ? 0.8 : 1 },
        variante === 'secundario' && { borderWidth: 1, borderColor: colores.borde },
        style,
      ]}
    >
      {icono && <Icono name={icono} size={20} color={colorTexto} />}
      <Text style={[estilos.botonTexto, { color: colorTexto }]}>{titulo}</Text>
    </Pressable>
  );
}

export function Chip({
  texto,
  activo,
  onPress,
  onLongPress,
  icono,
}: {
  texto: string;
  activo: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  icono?: NombreIcono;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[estilos.chip, activo && { backgroundColor: colores.primario, borderColor: colores.primario }]}
    >
      {icono && <Icono name={icono} size={16} color={activo ? '#fff' : colores.textoSuave} />}
      <Text style={[estilos.chipTexto, activo && { color: '#fff' }]}>{texto}</Text>
    </Pressable>
  );
}

export function Segmentado<T extends string>({
  opciones,
  valor,
  onCambio,
}: {
  opciones: { valor: T; etiqueta: string; icono?: NombreIcono }[];
  valor: T;
  onCambio: (v: T) => void;
}) {
  return (
    <View style={estilos.segmentado}>
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            accessibilityRole="tab"
            accessibilityState={{ selected: activo }}
            onPress={() => onCambio(o.valor)}
            style={[estilos.segmento, activo && estilos.segmentoActivo]}
          >
            {o.icono && <Icono name={o.icono} size={18} color={activo ? colores.primario : colores.textoSuave} />}
            <Text style={[estilos.segmentoTexto, activo && { color: colores.primario }]}>{o.etiqueta}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Tarjeta({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[estilos.tarjeta, style]}>{children}</View>;
}

export function Vacio({ icono, titulo, texto, children }: { icono: NombreIcono; titulo: string; texto?: string; children?: ReactNode }) {
  return (
    <View style={estilos.vacio}>
      <Icono name={icono} size={56} color={colores.borde} />
      <Text style={estilos.vacioTitulo}>{titulo}</Text>
      {texto && <Text style={estilos.vacioTexto}>{texto}</Text>}
      {children}
    </View>
  );
}

export const estilos = StyleSheet.create({
  boton: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  botonTexto: { fontSize: 16, fontWeight: '600' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colores.borde,
    backgroundColor: colores.superficie,
  },
  chipTexto: { fontSize: 15, color: colores.texto, fontWeight: '500' },
  segmentado: {
    flexDirection: 'row',
    backgroundColor: '#E6EAEE',
    borderRadius: 12,
    padding: 4,
  },
  segmento: {
    flex: 1,
    minHeight: 44,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segmentoActivo: {
    backgroundColor: colores.superficie,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentoTexto: { fontSize: 15, fontWeight: '600', color: colores.textoSuave },
  tarjeta: {
    backgroundColor: colores.superficie,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colores.borde,
  },
  vacio: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 10 },
  vacioTitulo: { fontSize: 18, fontWeight: '700', color: colores.texto, textAlign: 'center' },
  vacioTexto: { fontSize: 15, color: colores.textoSuave, textAlign: 'center', lineHeight: 21 },
  etiqueta: { fontSize: 13, fontWeight: '700', color: colores.textoSuave, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 18,
    color: colores.texto,
    backgroundColor: colores.superficie,
  },
});
