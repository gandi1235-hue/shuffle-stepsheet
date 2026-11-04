import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Character } from '../components/Avatar'
import { LevelUpOverlay } from '../components/LevelUp'
import TopBar from '../components/TopBar'
import { useToast } from '../components/ui'
import { getProfile, mySheetCount, shrinkImage, updateProfile, uploadAvatar, type Profile } from '../lib/api'
import { levelLabel, needFor, nextTitle, progressOf, titleOf } from '../lib/level'

/** 내 프로필: 캐릭터 그림 · 닉네임 · 레벨/칭호. 설정과 멤버 목록, 톡에서 내 이름을 눌러 들어온다 */
export default function ProfilePage() {
  const toast = useToast()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sheets, setSheets] = useState<number | null>(null)
  const [demo, setDemo] = useState(false)
  const [nick, setNick] = useState('')
  const [saving, setSaving] = useState(false)
  const [making, setMaking] = useState(false)
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const prog = progressOf(sheets ?? 0)
  const level = prog.lv
  const name = profile?.nickname?.trim() || profile?.display_name || '나'

  useEffect(() => {
    getProfile()
      .then((p) => {
        setProfile(p)
        setNick(p?.nickname ?? '')
      })
      .catch((e) => setErr(e.message))
    mySheetCount().then(setSheets).catch(() => undefined)
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
      setErr((er as Error).message)
    } finally {
      setSaving(false)
    }
  }
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setErr('')
    setMaking(true)
    try {
      const blob = await shrinkImage(f)
      setPreview({ blob, url: URL.createObjectURL(blob) })
    } catch (er) {
      setErr((er as Error).message)
    } finally {
      setMaking(false)
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
      toast('캐릭터를 바꿨어요')
    } catch (er) {
      setErr((er as Error).message)
    } finally {
      setSaving(false)
    }
  }
  const clearAvatar = async () => {
    if (!confirm('캐릭터 그림을 지우고 이름 첫 글자로 보일까요?')) return
    try {
      await updateProfile({ avatar_path: null })
      setProfile((p) => (p ? { ...p, avatar_path: null } : p))
    } catch (er) {
      setErr((er as Error).message)
    }
  }
  const nt = nextTitle(sheets ?? 0)

  return (
    <div className="screen">
      <TopBar title="내 프로필" back="/" />
      <div className="content">
        <section className="panel">
          <div className="profile-row">
            {preview ? <img className="character" src={preview.url} alt="새 캐릭터 미리보기" style={{ width: 110, height: 147 }} /> : <Character path={profile?.avatar_path} name={name} userId={profile?.id} width={110} />}
            <div className="grow">
              <div className="who-name" style={{ fontSize: 19 }}>{name}</div>
              <div className="panel-desc">본명 {profile?.display_name || '(없음)'}</div>
              <span className="chip lv" style={{ alignSelf: 'flex-start', marginTop: 4 }}>{levelLabel(level)}</span>
              <div className="lv-line">
                <span className="lv-bar"><i style={{ width: `${Math.round(prog.ratio * 100)}%` }} /></span>
                <span className="panel-desc" style={{ margin: 0 }}>{sheets === null ? '…' : `스텝지 ${sheets}장`}</span>
              </div>
              <div className="panel-desc" style={{ marginTop: 2 }}>
                {sheets === null ? '' : `${prog.left}장 더 만들면 Lv.${level + 1}`}
                {nt ? ` · ${nt.title}까지 ${nt.left}장` : ''}
              </div>
            </div>
          </div>
          {preview ? (
            <div className="row-btns" style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setPreview(null)} disabled={saving}>
                다시
              </button>
              <button type="button" className="btn primary" style={{ flex: 2 }} onClick={useAvatar} disabled={saving}>
                {saving ? '저장 중…' : '이 캐릭터로 할래요'}
              </button>
            </div>
          ) : (
            <div className="row-btns" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn primary" style={{ flex: 2, minWidth: 160 }} onClick={() => fileRef.current?.click()} disabled={making}>
                {making ? '…' : '캐릭터 사진 올리기'}
              </button>
              {profile?.avatar_path && (
                <button type="button" className="btn" style={{ flex: 1 }} onClick={clearAvatar} disabled={making}>
                  지우기
                </button>
              )}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={onFile} />
          <div className="panel-desc">캐릭터 그림이나 사진을 올리면 멤버들에게 그걸로 보여요. 세로 전신 그림이 잘 어울려요.</div>
        </section>

        <section className="panel">
          <div className="panel-title">닉네임</div>
          <form className="editrow" onSubmit={saveNick}>
            <input aria-label="닉네임" value={nick} onChange={(e) => setNick(e.target.value)} maxLength={20} placeholder="닉네임 (비우면 본명)" />
            <button type="submit" className="btn primary" disabled={saving || nick.trim() === (profile?.nickname ?? '')}>
              저장
            </button>
          </form>
          <div className="panel-desc">멤버 목록과 톡에는 닉네임이 보이고, 이름을 누르면 본명이 보여요.</div>
          {err && <div className="error">{err}</div>}
        </section>

        <section className="panel">
          <div className="panel-title">레벨과 칭호</div>
          <div className="panel-desc">
            다음 레벨에 필요한 스텝지가 1장, 2장, 3장… 늘어나요. 누적으로 Lv.2 1장, Lv.3 3장, Lv.4 6장, Lv.5 10장, Lv.6 15장, Lv.7 21장. <b>Lv.{titleLevel('2급강사')}</b>({needFor(titleLevel('2급강사'))}장)부터 2급강사, <b>Lv.{titleLevel('1급강사')}</b>({needFor(titleLevel('1급강사'))}장)부터 1급강사예요.
          </div>
          <button type="button" className="btn block" onClick={() => setDemo(true)}>
            ✨ 레벨업 연출 미리 보기
          </button>
          <div className="panel-desc">
            글자 크기·고대비·로그아웃은 <Link to="/settings">설정</Link>에 있어요.
          </div>
        </section>
      </div>
      {demo && <LevelUpOverlay info={{ from: level, to: level + 1, profile, sheets: needFor(level + 1) }} onClose={() => setDemo(false)} />}
    </div>
  )
}

const titleLevel = (t: string) => {
  for (let lv = 1; lv < 100; lv++) if (titleOf(lv) === t) return lv
  return 0
}
