import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,   // data is fresh for 2 min
      gcTime: 1000 * 60 * 10,     // keep unused cache for 10 min
      retry: false,                // no retries on RLS/auth errors
      refetchOnWindowFocus: true,  // refetch when app comes back into view
      refetchOnMount: true,        // refetch when navigating back to a screen
      refetchOnReconnect: true,    // refetch after coming back online
    },
  },
})
