import { useEffect, useRef, useState } from 'react'
import Avatar from '../components/Avatar'
import TopBar from '../components/TopBar'
import { getProfile, makeAvatar, squareThumb, updateProfile, uploadAvatar, type Profile } from '../lib/api'
import { useAuth } from '../lib/auth'
import { usePrefs, type FontSize } from '../lib/prefs'
import { supabase } from '../lib/supabase'
import { shareApp } from '../lib/share'
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
  const toast = useToast()
  const sendApp = async () => {
    const r = await shareApp()
    if (r === 'copied') toast('앱 소개 글을 복사했어요. 카카오톡에 붙여 넣으세요.')
  }

  // ── 내 프로필: 닉네임·아바타 ──
  const [profile, setProfile] = useState<Profile | null>(null)
  const [nick, setNick] = useState('')
  const [saving, setSaving] = useState(false)
  const [making, setMaking] = useState<'' | 'ai' | 'photo'>('')
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null)
  const [perr, setPerr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const modeRef = useRef<'ai' | 'photo'>('ai')
  useEffect(() => {
    getProfile()
      .then((p) => {
        setProfile(p)
        setNick(p?.nickname ?? '')
      })
      .catch((e) => setPerr(e.message))
  }, [])

  const saveNick = async (e: React.FormEvent) => {
    e.preventDefault()
    const v = nick.trim().slice(0, 20)
    setSaving(true)
    try {
      await updateProfile({ nickname: v })
      setProfile((p) => (p ? { ...p, nickname: v } : p))
      setNick(v)
      toast(v ? `닉네임을 "${v}"로 바꿨어요` : '닉네임을 지웠어요. 본명으로 보여요')
    } catch (er) {
      setPerr((er as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const pick = (mode: 'ai' | 'photo') => {
    modeRef.current = mode
    fileRef.current?.click()
  }
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setPerr('')
    setMaking(modeRef.current)
    try {
      const blob = modeRef.current === 'ai' ? await makeAvatar(f) : await squareThumb(f)
      setPreview({ blob, url: URL.createObjectURL(blob) })
    } catch (er) {
      setPerr((er as Error).message)
    } finally {
      setMaking('')
    }
  }
  const useAvatar = async () => {
    if (!preview) return
    setSaving(true)
    try {
      const path = await uploadAvatar(preview.blob)
      await updateProfile({ avatar_path: path })
      setProfile((p) => (p ? { ...p, avatar_path: path } : p))
      setPreview(null)
      toast('아바타를 바꿨어요')
    } catch (er) {
      setPerr((er as Error).message)
    } finally {
      setSaving(false)
    }
  }
  const clearAvatar = async () => {
    if (!confirm('아바타를 지우고 이름 첫 글자로 보일까요?')) return
    try {
      await updateProfile({ avatar_path: null })
      setProfile((p) => (p ? { ...p, avatar_path: null } : p))
    } catch (er) {
      setPerr((er as Error).message)
    }
  }

  return (
    <div className="screen">
      <TopBar title="설정" back="/" />
      <div className="content">
        <section className="panel">
          <div className="panel-title">내 프로필</div>
          <div className="profile-row">
            {preview ? <img className="avatar" src={preview.url} alt="새 아바타 미리보기" style={{ width: 72, height: 72 }} /> : <Avatar path={profile?.avatar_path} name={profile?.nickname || profile?.display_name || '나'} userId={profile?.id} size={72} />}
            <div className="grow">
              <div className="who-name" style={{ fontSize: 17 }}>{profile?.nickname?.trim() || profile?.display_name || '…'}</div>
              <div className="panel-desc">본명 {profile?.display_name || '(없음)'} · 멤버들이 이름을 누르면 본명이 보여요</div>
            </div>
          </div>
          {preview ? (
            <div className="row-btns" style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setPreview(null)} disabled={saving}>
                다시
              </button>
              <button type="button" className="btn primary" style={{ flex: 2 }} onClick={useAvatar} disabled={saving}>
                {saving ? '저장 중…' : '이 아바타로 할래요'}
              </button>
            </div>
          ) : (
            <div className="row-btns" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn primary" style={{ flex: 2, minWidth: 160 }} onClick={() => pick('ai')} disabled={!!making}>
                {making === 'ai' ? '만드는 중… (10초쯤)' : '✨ 사진으로 AI 아바타 만들기'}
              </button>
              <button type="button" className="btn" style={{ flex: 1 }} onClick={() => pick('photo')} disabled={!!making}>
                {making === 'photo' ? '…' : '사진 그대로'}
              </button>
              {profile?.avatar_path && (
                <button type="button" className="btn" style={{ flex: 1 }} onClick={clearAvatar} disabled={!!making}>
                  지우기
                </button>
              )}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={onFile} />
          <form className="editrow" onSubmit={saveNick}>
            <input aria-label="닉네임" value={nick} onChange={(e) => setNick(e.target.value)} maxLength={20} placeholder="닉네임 (비우면 본명)" />
            <button type="submit" className="btn primary" disabled={saving || nick.trim() === (profile?.nickname ?? '')}>
              저장
            </button>
          </form>
          {perr && <div className="error">{perr}</div>}
          <div className="panel-desc">AI 아바타는 얼굴이 잘 보이는 사진 한 장이면 돼요. 마음에 안 들면 "다시"를 눌러 다른 사진으로 또 만들 수 있어요.</div>
        </section>

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
