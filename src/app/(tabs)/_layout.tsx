import { Tabs } from 'expo-router';
import { colores, Icono, type NombreIcono } from '../../components/ui';

const icono =
  (nombre: NombreIcono) =>
  ({ color }: { color: unknown }) => <Icono name={nombre} color={String(color)} size={24} />;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colores.primario,
        tabBarInactiveTintColor: colores.textoSuave,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        headerStyle: { backgroundColor: colores.superficie },
        headerTitleStyle: { fontWeight: '700' },
        sceneStyle: { backgroundColor: colores.fondo },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Compra', headerShown: false, tabBarIcon: icono('cart-outline') }} />
      <Tabs.Screen name="radar" options={{ title: 'Precios', headerTitle: 'Radar de precios', tabBarIcon: icono('pricetags-outline') }} />
      <Tabs.Screen name="historial" options={{ title: 'Historial', headerTitle: 'Viajes de compra', tabBarIcon: icono('calendar-outline') }} />
      <Tabs.Screen name="comercios" options={{ title: 'Comercios', tabBarIcon: icono('storefront-outline') }} />
    </Tabs>
  );
}
