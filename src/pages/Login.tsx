import { useState } from 'react'
import { configured, supabase } from '../lib/supabase'
import { Music } from '../components/Icons'

const appUrl = () => window.location.href.split('#')[0]
// 카카오 로그인은 Supabase에서 Kakao provider를 켠 뒤 true로 바꿉니다.
const KAKAO_ENABLED = false

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')

  const kakao = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'kakao', options: { redirectTo: appUrl() } })
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
        <div className="mark"><Music /></div>
        <h1>스텝지함</h1>
        <p>셔플댄스 스텝지와 음원을 한곳에</p>
      </div>
      {!configured && <div className="error">Supabase 설정(.env)이 아직 없습니다. README를 참고해 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 넣어 주세요.</div>}
      {KAKAO_ENABLED && (
        <button type="button" className="btn big block kakao" onClick={kakao}>
          카카오로 시작하기
        </button>
      )}
      <form onSubmit={magic} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="field">
          <label htmlFor="email">이메일로 로그인 링크 받기</label>
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
