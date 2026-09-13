import { useState } from 'react'
import { ArrowRight, ChevronLeft, Eye, EyeOff, LockKeyhole, Mail, Sparkles } from 'lucide-react'
import { getSupabase } from './lib/supabase'
import { go } from './lib/navigate'
import { useSession, useRedirectIfSignedIn } from './lib/session'

export default function Signup() {
  const session = useSession()
  useRedirectIfSignedIn(session)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    const { error: signUpError } = await getSupabase().auth.signUp({ email, password })
    setSubmitting(false)
    if (signUpError) setError(signUpError.message)
  }

  return <main className="login-page">
    <section className="login-story">
      <div className="login-logo"><button className="logo logo-light" onClick={() => go('/')}>AliTapTap</button></div>
      <div className="story-copy">
        <span className="story-label"><Sparkles size={14} /> FOR BUSINESSES</span>
        <h1>Your own<br /><em>ordering page.</em></h1>
        <p>Create your store, add a few menu items, and start taking table orders in minutes.</p>
      </div>
      <p className="story-footer">Free to try, no card required.</p>
    </section>
    <section className="login-form-side">
      <button className="login-back" onClick={() => go('/')}><ChevronLeft /> Back to AliTapTap</button>
      <form className="login-form" onSubmit={submit}>
        <p className="form-kicker">GET STARTED</p>
        <h2>Create your account</h2>
        <p className="form-intro">Set up your business email and a password. We’ll walk you through the rest.</p>
        <label>Business email<div className="field"><Mail /><input value={email} onChange={e => { setEmail(e.target.value); setError('') }} type="email" autoComplete="email" required /></div></label>
        <label>Password<div className="field"><LockKeyhole /><input value={password} onChange={e => { setPassword(e.target.value); setError('') }} type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={6} required /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
        {error && <p className="login-error">{error}</p>}
        <button className="sign-in" type="submit" disabled={submitting}>{submitting ? 'Creating your account…' : <>Create account <ArrowRight /></>}</button>
      </form>
      <p className="login-help">Already have a store? <button type="button" onClick={() => go('/login')}>Sign in</button></p>
    </section>
  </main>
}
