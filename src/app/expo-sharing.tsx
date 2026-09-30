import { Redirect } from 'expo-router';

// Android abre compras://expo-sharing al recibir "Compartir → Compras" desde WhatsApp;
// la pantalla de importar lee el texto compartido.
export default function RecibirCompartido() {
  return <Redirect href="/importar" />;
}
