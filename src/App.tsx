import { useAuth } from '@/features/auth/auth-context'
import { useFamilyMember } from '@/features/auth/use-family-member'
import { LoginPage } from '@/features/auth/login-page'
import { FamilySetup } from '@/features/auth/family-setup'
import { Dashboard } from '@/features/dashboard/dashboard'

export default function App() {
  const { user, loading } = useAuth()
  const { data: familyMember, isLoading: memberLoading, refetch } = useFamilyMember()

  if (loading || (user && memberLoading)) {
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
    return <FamilySetup onComplete={() => refetch()} />
  }

  return <Dashboard />
}
