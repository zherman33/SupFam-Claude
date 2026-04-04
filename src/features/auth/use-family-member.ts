import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './auth-context'

export interface FamilyMember {
  id: string
  family_id: string
  user_id: string
  display_name: string
  role: 'admin' | 'member'
  avatar_color: string | null
  joined_at: string
  families?: {
    id: string
    name: string
    invite_code: string | null
    created_at: string
  }
}

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
        .maybeSingle()

      if (error) return null
      return data as FamilyMember
    },
    enabled: !!user,
    // No retries — null result means "show setup screen" immediately,
    // not hang in a loading state through exponential backoff
    retry: false,
    // Don't treat a null result as stale for 5 minutes once we have data
    staleTime: 1000 * 60 * 5,
  })
}

export function useFamilyMembers() {
  const { data: member } = useFamilyMember()

  return useQuery({
    queryKey: ['family-members', member?.family_id],
    enabled: !!member?.family_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('family_members')
        .select('id, display_name, avatar_color, role')
        .eq('family_id', member!.family_id)
        .order('joined_at', { ascending: true })
      if (error) throw error
      return data as Pick<FamilyMember, 'id' | 'display_name' | 'avatar_color' | 'role'>[]
    },
  })
}
