import { useAuth } from '@/features/auth/auth-context'
import { useFamilyMember } from '@/features/auth/use-family-member'
import { LoginPage } from '@/features/auth/login-page'
import { FamilySetup } from '@/features/auth/family-setup'

export default function App() {
  const { user, loading } = useAuth()
  const { data: familyMember, isLoading: memberLoading, refetch } = useFamilyMember()

  if (loading || (user && memberLoading)) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-cream-100">
        <p className="font-handwritten text-2xl text-brown-700">Loading...</p>
      </div>
    )
  }

  // Not signed in
  if (!user) {
    return <LoginPage />
  }

  // Signed in but no family yet
  if (!familyMember) {
    return <FamilySetup onComplete={() => refetch()} />
  }

  // Signed in with a family — main dashboard shell
  return (
    <div className="min-h-svh bg-cream-100 p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="font-handwritten text-4xl text-terracotta-500">
          Sup Fam
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-brown-700">
            {familyMember.display_name}
          </span>
        </div>
      </header>

      {/* Three-panel iPad layout placeholder */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="font-display text-xl text-brown-800">
            What's on today
          </h2>
          <p className="mt-2 text-sm text-brown-700/60">
            Today panel coming soon
          </p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="font-display text-xl text-brown-800">Your week</h2>
          <p className="mt-2 text-sm text-brown-700/60">
            Calendar coming soon
          </p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="font-display text-xl text-brown-800">Don't forget</h2>
          <p className="mt-2 text-sm text-brown-700/60">
            Grocery list & notes coming soon
          </p>
        </div>
      </div>
    </div>
  )
}
