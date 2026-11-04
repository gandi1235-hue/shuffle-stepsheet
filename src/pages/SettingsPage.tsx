import TopBar from '../components/TopBar'
import { useAuth } from '../lib/auth'
import { usePrefs, type FontSize } from '../lib/prefs'
import { supabase } from '../lib/supabase'

const SIZES: [FontSize, string, string][] = [
  ['normal', '보통', '가'],
  ['large', '크게', '가'],
  ['xlarge', '아주 크게', '가'],
]

export default function SettingsPage() {
  const [prefs, update] = usePrefs()
  const { session } = useAuth()
  const standalone = window.matchMedia('(display-mode: standalone)').matches

  return (
    <div className="screen">
      <TopBar title="설정" back="/" />
      <div className="content">
        <section className="panel">
          <div className="panel-title">글자 크기</div>
          <div className="seg" role="radiogroup" aria-label="글자 크기">
            {SIZES.map(([k, label, sample]) => (
              <button key={k} type="button" role="radio" aria-checked={prefs.font === k} className={prefs.font === k ? 'on' : ''} onClick={() => update({ font: k })}>
                <span className={`sample ${k}`}>{sample}</span>
                {label}
              </button>
            ))}
          </div>
          <div className="panel-desc">스텝지, 목록, 버튼 글자가 모두 함께 커져요.</div>
        </section>

        <section className="panel">
          <label className="switch-row">
            <span>
              <b>고대비 모드</b>
              <span className="panel-desc">글자를 더 진하게, 테두리를 더 또렷하게</span>
            </span>
            <input type="checkbox" role="switch" checked={prefs.contrast} onChange={(e) => update({ contrast: e.target.checked })} />
            <span className="switch" aria-hidden="true" />
          </label>
        </section>

        <section className="panel">
          <div className="panel-title">앱으로 쓰기</div>
          <div className="panel-desc">
            {standalone
              ? '지금 홈 화면 앱으로 열려 있어요.'
              : '브라우저 메뉴(⋮ 또는 공유) → "홈 화면에 추가"를 누르면 주소창 없이 전체 화면으로 열려요.'}
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">계정</div>
          <div className="panel-desc">{session?.user.email ?? ''}</div>
          <button type="button" className="btn block" onClick={() => supabase.auth.signOut()}>
            로그아웃
          </button>
        </section>

        <div className="panel-desc" style={{ textAlign: 'center' }}>
          ShuffleBox · 버전 {__APP_VERSION__}
        </div>
      </div>
    </div>
  )
}
