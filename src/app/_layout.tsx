import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Boton, colores } from '../components/ui';
import { useCompraStore } from '../store/useCompraStore';

export default function RootLayout() {
  const { listo, error, iniciar } = useCompraStore();

  useEffect(() => {
    iniciar();
  }, [iniciar]);

  // Al volver a la app se revisa si la tasa ya no es de hoy (solo descarga si hace falta).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active' && useCompraStore.getState().listo) useCompraStore.getState().actualizarTasa();
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {!listo ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: colores.fondo }}>
          {error ? (
            <>
              <Text style={{ fontSize: 16, color: colores.peligro, textAlign: 'center' }}>No se pudo abrir la base de datos: {error}</Text>
              <Boton titulo="Reintentar" onPress={iniciar} />
            </>
          ) : (
            <ActivityIndicator size="large" color={colores.primario} />
          )}
        </View>
      ) : (
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colores.superficie },
            headerTintColor: colores.texto,
            contentStyle: { backgroundColor: colores.fondo },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="importar" options={{ title: 'Pegar lista', presentation: 'modal' }} />
          <Stack.Screen name="historial/[id]" options={{ title: 'Detalle de compra' }} />
          <Stack.Screen name="producto/[id]" options={{ title: 'Producto' }} />
        </Stack>
      )}
    </SafeAreaProvider>
  );
}
