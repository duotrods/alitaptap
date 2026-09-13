import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { getSupabase } from './supabase'
import { getOwnedStore, type OwnedStore } from './store'
import { go } from './navigate'

export type Session =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: User; store: OwnedStore | null }

export function useSession(): Session {
  const [session, setSession] = useState<Session>({ status: 'loading' })

  useEffect(() => {
    let current = true
    const supabase = getSupabase()

    async function resolve(user: User | null) {
      if (!user) { if (current) setSession({ status: 'signed-out' }); return }
      const store = await getOwnedStore(supabase)
      if (current) setSession({ status: 'signed-in', user, store })
    }

    supabase.auth.getSession().then(({ data }) => resolve(data.session?.user ?? null))
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, authSession) => {
      void resolve(authSession?.user ?? null)
    })

    return () => {
      current = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  return session
}

export function useRedirectIfSignedIn(session: Session) {
  useEffect(() => {
    if (session.status !== 'signed-in') return
    go(session.store ? '/dashboard/orders' : '/onboarding')
  }, [session])
}
