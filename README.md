# Compras

App móvil (Android/iOS) para hacer las compras del negocio en supermercados y mayoristas:
pegas la lista que te mandan por WhatsApp, marcas lo que vas comprando con una mano,
registras precio, comercio y método de pago, y la app va armando el historial de
precios para saber dónde conviene comprar cada cosa. Todo en bolívares (Bs.) y 100 % offline.

## Funciones

| Pantalla | Qué hace |
| --- | --- |
| **Compra** | Lista activa con pestañas *Pendientes* / *Comprados*, progreso (8/15), total gastado en Bs. y, bajo cada pendiente, el último precio pagado y el comercio más barato conocido. Botón flotante **Pegar lista** y campo para agregar productos sueltos. |
| **Registro rápido** | Hoja inferior al tocar un producto: cantidad comprada (con +/−) vs. pedida, monto total o precio unitario, comercio, **Tarjeta / Pago Móvil** y foto del ticket (cámara, galería o "usar el mismo ticket anterior"). Compara contra el último precio (+/−%). |
| **Pegar lista** | Pega el mensaje de WhatsApp (se toma del portapapeles automáticamente). Entiende viñetas, emojis, `*negritas*`, prefijos de chat exportado y cantidades como `2 kg de harina`, `Harina x3`, `Queso 1/2 kilo`, `3 cajas de leche`. Puedes descartar líneas antes de crear la lista. |
| **Precios** | Buscador de productos con los comercios ordenados del más barato al más caro, fecha del último registro, mínimo histórico y % de ahorro. Toca un producto para ver sus últimos registros. |
| **Historial** | Compras cerradas por fecha con total, gasto del mes y detalle: desglose por método de pago y por comercio, y los tickets fotografiados. |
| **Comercios** | Alta, edición y baja de comercios (Mayorista / Supermercado / Otro). |

Al cerrar una compra con pendientes puedes pasarlos automáticamente a una lista nueva.

## Stack

- Expo SDK 57 + React Native + TypeScript, navegación con Expo Router (`src/app/`).
- SQLite local (`expo-sqlite`) con migraciones por `PRAGMA user_version` (`src/db/database.ts`).
- Zustand para el estado de la compra activa (`src/store/useCompraStore.ts`).
- `expo-image-picker` + `expo-file-system` para los tickets (se copian a la carpeta de la app).
- `expo-clipboard` y `expo-haptics`.

```
src/
  app/                 pantallas (Expo Router)
    (tabs)/            Compra, Precios, Historial, Comercios
    importar.tsx       pegar lista de WhatsApp
    historial/[id].tsx detalle de una compra
  components/          UI compartida y hoja de registro
  db/                  esquema SQLite y consultas
  lib/                 parser de WhatsApp, formato de Bs., fotos
  store/               estado (Zustand)
```

### Modelo de datos

Sigue la especificación (`comercio`, `producto`, `lista_compra`, `item_compra`,
`registro_precio_historico`) con algunos campos extra: `producto.nombre_normalizado`
(para reconocer "Azúcar" y "azucar" como el mismo producto), `item_compra.unidad`,
`texto_original`, `comprado_en` y `orden`, `registro_precio_historico.item_id` (una
compra editada reemplaza su precio en vez de duplicarlo) y una tabla `ajuste` que
recuerda el último comercio y método de pago usados.

## Desarrollo

```bash
npm install
npx expo start          # escanea el QR con Expo Go en el teléfono
npm test                # pruebas del parser y del formato de montos
npm run typecheck
```

Todas las librerías usadas vienen incluidas en Expo Go, así que no hace falta una build
nativa para probar.

## Generar el APK (Fase 5)

```bash
npx eas-cli@latest login
npm run build:apk       # perfil "preview" de eas.json → .apk instalable
```

EAS compila en la nube y devuelve un enlace para descargar el `.apk` e instalarlo en el teléfono.

## Estado de las fases

- [x] Fase 1 – Proyecto Expo, SQLite y entidades.
- [x] Fase 2 – Importador de WhatsApp y checklist.
- [x] Fase 3 – Registro rápido de compra, pagos y sumatoria en Bs.
- [x] Fase 4 – Historial automático de precios y radar por comercio.
- [ ] Fase 5 – Pruebas en dispositivo y compilación del APK (configurado; falta correr `eas build`).
