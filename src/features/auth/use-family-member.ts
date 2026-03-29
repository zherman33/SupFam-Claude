import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './auth-context'

export function useFamilyMember() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['family-member', user?.id],
    queryFn: async () => {
      if (!user) return null

      const { data, error } = await supabase
        .from('family_members')
        .select('*, families(*)')
        .eq('user_id', user.id)
        .single()

      if (error) return null
      return data
    },
    enabled: !!user,
  })
}
