import { useState } from 'react'
import { configured, supabase } from '../lib/supabase'
import { Dancer } from '../components/Icons'

const appUrl = () => window.location.href.split('#')[0]
// Supabase Kakao provider 연결됨 (2026-11)
const KAKAO_ENABLED = true

const KakaoMark = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path fill="#191919" d="M12 3C6.48 3 2 6.58 2 11c0 2.83 1.86 5.31 4.66 6.73-.2.73-.74 2.68-.85 3.1-.13.52.19.51.4.37.17-.11 2.66-1.8 3.74-2.53.66.1 1.35.15 2.05.15 5.52 0 10-3.58 10-8S17.52 3 12 3z" />
  </svg>
)

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')

  const kakao = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'kakao', options: { redirectTo: appUrl(), scopes: 'profile_nickname' } })
    if (error) setErr(error.message)
  }

  const magic = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: appUrl() } })
    if (error) setErr(error.message)
    else setSent(true)
  }

  return (
    <div className="login">
      <div>
        <div className="mark"><Dancer /></div>
        <h1>스텝지함</h1>
        <p>셔플댄스 스텝지와 음원을 한곳에</p>
      </div>
      {!configured && <div className="error">Supabase 설정(.env)이 아직 없습니다. README를 참고해 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 넣어 주세요.</div>}
      {KAKAO_ENABLED && (
        <>
          <button type="button" className="btn big block kakao" onClick={kakao}>
            <KakaoMark /> 카카오로 시작하기
          </button>
          <div className="or">또는</div>
        </>
      )}
      <form onSubmit={magic} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="field">
          <label htmlFor="email">이메일로 로그인 링크 받기{KAKAO_ENABLED ? ' (카카오가 안 될 때)' : ''}</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com" />
        </div>
        <button type="submit" className="btn primary block">
          링크 보내기
        </button>
        {sent && <div className="notice">메일함에서 로그인 링크를 눌러 주세요.</div>}
        {err && <div className="error">{err}</div>}
      </form>
    </div>
  )
}
