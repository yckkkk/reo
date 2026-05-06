import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

export function createReoQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function ReoQueryProvider({ children }: { readonly children: ReactNode }) {
  const [queryClient] = useState(() => createReoQueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
