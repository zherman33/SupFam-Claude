import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'

/**
 * Whether the signed-in user is Sup Fam staff (present in staff_emails).
 * Gates the embedded UX analytics dashboard. Returns false while
 * loading or when the is_staff() RPC doesn't exist yet (migration not
 * applied) — never blocks the main app.
 */
export function useIsStaff(): boolean {
  const { user } = useAuth()
  const { data } = useQuery({
    queryKey: ['is-staff', user?.id],
    enabled: !!user,
    retry: false,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_staff')
      if (error) return false
      return data === true
    },
  })
  return data === true
}
