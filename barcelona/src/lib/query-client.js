import { QueryClient } from '@tanstack/react-query';

// Dos usuarios trabajan a la vez (dirección y caja): lo que capture uno debe verse en la
// pantalla del otro sin tener que recargar. Al volver a la pestaña o recuperar conexión se
// vuelve a consultar el servidor; los datos se consideran vigentes solo 15 s.
export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: true,
			refetchOnReconnect: true,
			staleTime: 15_000,
			retry: 1,
		},
	},
});
