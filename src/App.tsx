import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { useFamilyMember } from '@/features/auth/use-family-member'
import { LoginPage } from '@/features/auth/login-page'
import { FamilySetup } from '@/features/auth/family-setup'
import { Dashboard } from '@/features/dashboard/dashboard'

export default function App() {
  const { user, loading } = useAuth()
  const queryClient = useQueryClient()
  // isFetching: actively in-flight. isLoading: no data yet AND fetching.
  // We only block on loading if the auth state is still resolving, or
  // the member query is actively fetching (not retrying with backoff).
  const { data: familyMember, isFetching: memberFetching } = useFamilyMember()

  // Only show the splash while:
  // 1. Auth state is still resolving from Supabase
  // 2. User is logged in and we're actively fetching their member record (first load)
  if (loading || (user && memberFetching && familyMember === undefined)) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-cream-100">
        <p className="font-handwritten text-2xl text-terracotta-500">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  if (!familyMember) {
    return (
      <FamilySetup
        onComplete={() => {
          // Invalidate all family-related queries so they refetch fresh
          queryClient.invalidateQueries({ queryKey: ['family-member'] })
          queryClient.invalidateQueries({ queryKey: ['family-members'] })
        }}
      />
    )
  }

  return <Dashboard />
}
