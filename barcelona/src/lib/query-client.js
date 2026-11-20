import { QueryClient } from '@tanstack/react-query';

// Dos usuarios trabajan a la vez (dirección y caja): lo que capture uno debe verse en la
// pantalla del otro sin tener que recargar. Al volver a la pestaña o recuperar conexión se
// vuelve a consultar el servidor. staleTime se queda en 0 (default): al entrar a cualquier
// pantalla siempre se consulta el servidor (un saldo de caja nunca debe salir de caché).
export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: true,
			refetchOnReconnect: true,
			retry: 1,
		},
	},
});
