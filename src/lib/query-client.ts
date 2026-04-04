import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      // No global retries — individual queries opt in if needed.
      // Retrying on auth/RLS errors just causes loading hangs.
      retry: false,
    },
  },
})
