import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export function Login() {
  const navigate = useNavigate()
  const { session, loading } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && session) navigate('/', { replace: true })
  }, [session, loading])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (error) {
      setError('E-Mail oder Passwort falsch.')
    } else {
      navigate('/', { replace: true })
    }
  }

  const inputCls = 'w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-colors'

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
            <span className="text-sm font-bold text-white">G</span>
          </div>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight text-lg">Greyboard CRM</span>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
          <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-5">Anmelden</h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">E-Mail</label>
              <input
                type="email"
                autoFocus
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="deine@email.de"
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Passwort</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputCls}
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors mt-1"
            >
              {submitting ? 'Anmelden…' : 'Anmelden'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
