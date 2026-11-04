import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Character } from '../components/Avatar'
import { Chevron } from '../components/Icons'
import { levelLabel, levelOf } from '../lib/level'
import TopBar from '../components/TopBar'
import HelpButton from '../components/HelpButton'
import { getProfile, mySheetCount, type Profile } from '../lib/api'
import { useAuth } from '../lib/auth'
import { usePrefs, type FontSize } from '../lib/prefs'
import { supabase } from '../lib/supabase'
import { shareApp } from '../lib/share'
import { resetGuides } from '../lib/tour'
import { useToast } from '../components/ui'

const SIZES: [FontSize, string, string][] = [
  ['normal', '보통', '가'],
  ['large', '크게', '가'],
  ['xlarge', '아주 크게', '가'],
]

export default function SettingsPage() {
  const [prefs, update] = usePrefs()
  const { session } = useAuth()
  const standalone = window.matchMedia('(display-mode: standalone)').matches
  const nav = useNavigate()
  const toast = useToast()
  const sendApp = async () => {
    const r = await shareApp()
    if (r === 'copied') toast('앱 소개 글을 복사했어요. 카카오톡에 붙여 넣으세요.')
  }

  // ── 내 프로필(요약만, 바꾸기는 /profile) ──
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sheets, setSheets] = useState<number | null>(null)
  const level = levelOf(sheets ?? 0)
  useEffect(() => {
    getProfile().then(setProfile).catch(() => undefined)
    mySheetCount().then(setSheets).catch(() => undefined)
  }, [])

  return (
    <div className="screen">
      <TopBar title="설정" back="/" right={<HelpButton page="settings" />} />
      <div className="content">
        <Link to="/profile" className="card" style={{ marginBottom: 12 }}>
          <Character path={profile?.avatar_path} name={profile?.nickname || profile?.display_name || '나'} userId={profile?.id} width={48} />
          <span className="grow">
            <span className="t">
              {profile?.nickname?.trim() || profile?.display_name || '내 프로필'} <span className="chip lv">{levelLabel(level)}</span>
            </span>
            <span className="s">캐릭터 그림 · 닉네임 · 레벨 보기와 바꾸기</span>
          </span>
          <Chevron />
        </Link>
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
          <div className="panel-title">친구에게 앱 보내기</div>
          <div className="panel-desc">카카오톡으로 앱 링크를 보내요. 받은 사람이 링크를 열고 카카오로 로그인하면 바로 쓸 수 있고, 새 기능이 나오면 모두의 앱에 자동으로 반영돼요.</div>
          <button type="button" className="btn block" onClick={sendApp}>
            카카오톡으로 앱 보내기
          </button>
          <div className="panel-desc">앱 버전 {__APP_VERSION__}</div>
        </section>

        <section className="panel">
          <div className="panel-title">처음 사용 안내</div>
          <div className="panel-desc">앱을 어떻게 쓰는지 카드로 보여 주고, 첫 화면·스텝지·동기화 화면에서 버튼을 하나씩 짚어 줘요.</div>
          <button type="button" className="btn block" onClick={() => { resetGuides(); nav('/') }}>
            안내 다시 보기
          </button>
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
