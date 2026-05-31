'use client'
import { createClient } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#080810',
      display: 'flex', fontFamily: "'DM Sans', sans-serif",
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: `radial-gradient(ellipse at 20% 50%, rgba(0,232,122,0.08) 0%, transparent 50%),
                          radial-gradient(ellipse at 80% 20%, rgba(255,107,53,0.06) 0%, transparent 50%)`,
      }} />
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: '440px', padding: '48px 40px',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px', filter: 'drop-shadow(0 0 30px rgba(0,232,122,0.3))' }}>⚽</div>
          <h1 className="font-display" style={{ fontSize: '52px', letterSpacing: '2px', color: '#fff', lineHeight: 1, marginBottom: '6px' }}>MUNDIAL</h1>
          <h2 className="font-display" style={{ fontSize: '28px', letterSpacing: '6px', color: '#00e87a', lineHeight: 1, marginBottom: '16px' }}>HOMIO 2026</h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', lineHeight: 1.6 }}>
            La quiniela del Mundial con tu familia y amigos.<br/>Predice, compite y gana.
          </p>
        </div>

        {/* Entry fee badge */}
        <div style={{
          background: 'rgba(0,232,122,0.08)', border: '1px solid rgba(0,232,122,0.2)',
          borderRadius: '12px', padding: '16px', marginBottom: '32px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '2px', marginBottom: '8px' }}>INSCRIPCION</div>
          <div className="font-display" style={{ fontSize: '36px', color: '#00e87a', letterSpacing: '2px' }}>$10 USD</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>80% al premio · 20% admin fee</div>
        </div>

        {error && (
          <div style={{
            background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.25)',
            borderRadius: '10px', padding: '12px 16px', marginBottom: '24px',
            fontSize: '13px', color: '#ff6b35',
          }}>
            Hubo un error al iniciar sesion. Intenta de nuevo.
          </div>
        )}

        <button onClick={handleGoogleLogin} style={{
          width: '100%', padding: '18px 24px',
          background: '#fff', color: '#111', border: 'none', borderRadius: '14px',
          fontSize: '15px', fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
          fontFamily: "'DM Sans', sans-serif", transition: 'opacity 0.15s', marginBottom: '16px',
        }}
          onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
          onMouseOut={e => e.currentTarget.style.opacity = '1'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Entrar con Google
        </button>

        {/* Prizes preview */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '24px', marginTop: '8px' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', letterSpacing: '2px', marginBottom: '12px', textAlign: 'center' }}>PREMIOS</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { place: '1er', pct: '60%', color: '#ffd700' },
              { place: '2do', pct: '30%', color: '#c0c0c0' },
              { place: '3er', pct: '10%', color: '#cd7f32' },
            ].map((p, i) => (
              <div key={i} style={{
                flex: 1, background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '10px', padding: '12px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: p.color }}>{p.place}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>{p.pct} del pool</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return <Suspense><LoginContent /></Suspense>
}
