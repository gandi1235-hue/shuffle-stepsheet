import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Character } from '../components/Avatar'
import { LevelUpOverlay } from '../components/LevelUp'
import TopBar from '../components/TopBar'
import HelpButton from '../components/HelpButton'
import { useToast } from '../components/ui'
import { getProfile, makeAvatar, mySheetCount, shrinkImage, updateProfile, uploadAvatar, type Profile } from '../lib/api'
import { TIER_IMAGE_NAMES, TITLES, imageTier, levelLabel, needFor, nextTitle, progressOf } from '../lib/level'

/** 내 프로필: 캐릭터 그림 · 닉네임 · 레벨/칭호. 설정과 멤버 목록, 톡에서 내 이름을 눌러 들어온다 */
export default function ProfilePage() {
  const toast = useToast()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sheets, setSheets] = useState<number | null>(null)
  const [demo, setDemo] = useState(false)
  const [nick, setNick] = useState('')
  const [saving, setSaving] = useState(false)
  const [making, setMaking] = useState<'' | 'ai' | 'photo'>('')
  const modeRef = useRef<'ai' | 'photo'>('photo')
  const pick = (mode: 'ai' | 'photo') => {
    modeRef.current = mode
    fileRef.current?.click()
  }
  /** 새 캐릭터 미리보기: AI면 등급별 4장, 그림 올리기면 1장 */
  const [preview, setPreview] = useState<{ blobs: Blob[]; urls: string[] } | null>(null)
  const [progress, setProgress] = useState('')
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
    setMaking(modeRef.current)
    try {
      const blobs: Blob[] = []
      if (modeRef.current === 'ai') {
        // 등급별 4장: 기본 → 2급강사 → 1급강사 → 셔플킹/퀸. 승급할 때마다 다음 그림으로 바뀜
        for (let t = 1; t <= 4; t++) {
          setProgress(`${t}/4 ${TIER_IMAGE_NAMES[t - 1]} 그리는 중…`)
          blobs.push(await makeAvatar(f, t))
        }
      } else blobs.push(await shrinkImage(f))
      setPreview({ blobs, urls: blobs.map((b) => URL.createObjectURL(b)) })
    } catch (er) {
      setErr((er as Error).message)
    } finally {
      setMaking('')
      setProgress('')
    }
  }
  const useAvatar = async () => {
    if (!preview) return
    setSaving(true)
    try {
      const paths: string[] = []
      for (const b of preview.blobs) paths.push(await uploadAvatar(b))
      const tiers = paths.length > 1 ? paths : null
      await updateProfile({ avatar_path: paths[0], avatar_tiers: tiers })
      setProfile((p) => (p ? { ...p, avatar_path: paths[0], avatar_tiers: tiers } : p))
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
      await updateProfile({ avatar_path: null, avatar_tiers: null })
      setProfile((p) => (p ? { ...p, avatar_path: null, avatar_tiers: null } : p))
    } catch (er) {
      setErr((er as Error).message)
    }
  }
  const nt = nextTitle(sheets ?? 0)

  return (
    <div className="screen">
      <TopBar title="내 프로필" back="/" right={<HelpButton page="profile" />} />
      <div className="content">
        <section className="panel">
          <div className="profile-row">
            {preview ? <img className="character" src={preview.urls[Math.min(imageTier(level), preview.urls.length - 1)]} alt="새 캐릭터 미리보기" style={{ width: 110, height: 147 }} /> : <Character path={profile?.avatar_path} tiers={profile?.avatar_tiers} level={level} name={name} userId={profile?.id} width={110} />}
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
          {preview && preview.urls.length > 1 && (
            <div className="tier-row">
              {preview.urls.map((u, i) => (
                <figure key={i} className={i === imageTier(level) ? 'now' : ''}>
                  <img src={u} alt={TIER_IMAGE_NAMES[i]} />
                  <figcaption>{TIER_IMAGE_NAMES[i]}</figcaption>
                </figure>
              ))}
            </div>
          )}
          {!preview && profile?.avatar_tiers && profile.avatar_tiers.length > 1 && (
            <div className="tier-row">
              {profile.avatar_tiers.map((pth, i) => (
                <figure key={pth} className={i === imageTier(level) ? 'now' : i > imageTier(level) ? 'locked' : ''}>
                  <Character path={pth} name={name} userId={profile.id} width={64} />
                  <figcaption>{i > imageTier(level) ? '🔒 ' : ''}{TIER_IMAGE_NAMES[i]}</figcaption>
                </figure>
              ))}
            </div>
          )}
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
              <button type="button" className="btn primary" style={{ flex: 2, minWidth: 170 }} onClick={() => pick('ai')} disabled={!!making}>
                {making === 'ai' ? progress || '만드는 중…' : '✨ 사진으로 AI 캐릭터 4장 만들기'}
              </button>
              <button type="button" className="btn" style={{ flex: 1 }} onClick={() => pick('photo')} disabled={!!making}>
                {making === 'photo' ? '…' : '그림 그대로 올리기'}
              </button>
              {profile?.avatar_path && (
                <button type="button" className="btn" style={{ flex: 1 }} onClick={clearAvatar} disabled={!!making}>
                  지우기
                </button>
              )}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={onFile} />
          <div className="panel-desc">AI 캐릭터는 얼굴이 잘 보이는 사진 한 장이면 돼요(전신이면 옷까지 닮아요). 기본·2급강사·1급강사·셔플킹/퀸 4장을 한 번에 그려서, 승급할 때마다 더 화려한 그림으로 바뀌어요 (1~2분 걸려요). 이미 만든 그림이 있으면 그대로 올려도 돼요.</div>
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
          <div className="panel-title">레벨과 등급</div>
          <div className="tier-table">
            {TITLES.map((t, i) => {
              const next = TITLES[i + 1]
              const range = next ? (next.lv - t.lv === 1 ? `Lv.${t.lv}` : `Lv.${t.lv}~${next.lv - 1}`) : `Lv.${t.lv}~`
              return (
                <div key={t.lv} className={level >= t.lv && (!next || level < next.lv) ? 'now' : ''}>
                  <b>{t.title}</b>
                  <span>{range}</span>
                  <small>스텝지 {needFor(t.lv)}장부터</small>
                </div>
              )
            })}
          </div>
          <div className="panel-desc">다음 레벨에 필요한 스텝지가 1장, 2장, 3장… 늘어나요. 등급이 오르면 AI 캐릭터도 더 화려한 그림으로 바뀌어요.</div>
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
