import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Player, { isVideoSrc, type PlayerHandle } from '../components/Player'
import YouTubePlayer, { youtubeId } from '../components/YouTubePlayer'
import SheetTable from '../components/SheetTable'
import TopBar from '../components/TopBar'
import HelpButton from '../components/HelpButton'
import Tour from '../components/Tour'
import { Sheet as Modal, Skeleton, useToast } from '../components/ui'
import { Copy, Doc, Edit, LayoutSide, LayoutTop, More, Photo, Print, Share } from '../components/Icons'
import { copySheet, deleteSheet, getFolder, getSheet, listFolders, listVersions, moveSheet, setFinalized, signedUrl, updateMemo, updateSync } from '../lib/api'
import { activeLine, eventsOf, savedBpm, withSync, type Folder, type Stepsheet } from '../lib/types'
import { bpmFromEvents, defaultEvents } from '../lib/sync'
import { useMedia, usePrefs } from '../lib/prefs'

export default function SheetPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [sheet, setSheet] = useState<Stepsheet | null>(null)
  const [folder, setFolder] = useState<Folder | null>(null)
  const [audio, setAudio] = useState<string>('')
  const [photos, setPhotos] = useState<string[]>([])
  const [showPhotos, setShowPhotos] = useState(false)
  const [big, setBig] = useState(false)
  const [menu, setMenu] = useState<null | 'more' | 'copy' | 'move'>(null)
  const [docView, setDocView] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])
  const [prefs, updatePrefs] = usePrefs()
  const wide = useMedia('(min-width: 900px)')
  /** 영상 배치: 고른 게 없으면 넓은 화면에서만 좌우 */
  const sideLayout = prefs.videoLayout ? prefs.videoLayout === 'side' : wide
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const toast = useToast()
  const player = useRef<PlayerHandle | null>(null)
  const [t, setT] = useState(0)
  const [source, setSourceState] = useState<'file' | 'youtube'>(() => (localStorage.getItem(`src-${id}`) === 'youtube' ? 'youtube' : 'file'))
  const setSource = (v: 'file' | 'youtube') => {
    setSourceState(v)
    localStorage.setItem(`src-${id}`, v)
  }

  useEffect(() => {
    getSheet(id)
      .then(async (s) => {
        setSheet(s)
        if (!s) return
        getFolder(s.folder_id).then(setFolder)
        if (s.audio_path) setAudio(await signedUrl('audio', s.audio_path))
        else if (s.audio_url) setAudio(s.audio_url)
        if (s.photo_paths?.length) setPhotos(await Promise.all(s.photo_paths.map((p) => signedUrl('photos', p))))
      })
      .catch((e) => setErr(e.message))
  }, [id])

  // 연습 중 화면 꺼짐 방지
  useEffect(() => {
    let lock: { release: () => void } | null = null
    const n = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => void }> } }
    n.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => undefined)
    return () => lock?.release()
  }, [])

  if (err) return <div className="error">{err}</div>
  if (!sheet)
    return (
      <div className="content">
        <Skeleton rows={1} h={110} />
        <Skeleton rows={6} h={48} />
      </div>
    )

  const canEdit = folder?.role === 'owner' || folder?.role === 'editor'
  /** 수정 화면으로. 수정 완료로 표시된 스텝지면 한 번 묻는다 */
  const goEdit = () => {
    if (!sheet) return
    if (sheet.finalized && !confirm('⚠️ 이 스텝지는 "수정 완료"로 표시돼 있어요.\n그래도 고칠까요? 고쳐서 저장하면 수정 완료 표시가 풀려요.')) return
    nav(`/edit/${sheet.id}`, { state: { okFinal: true } })
  }
  const toggleFinalized = async () => {
    if (!sheet) return
    const next = !sheet.finalized
    try {
      await setFinalized(sheet.id, next)
      setSheet({ ...sheet, finalized: next })
      toast(next ? '✔ 수정 완료로 표시했어요. 이제 고치려 하면 한 번 더 물어봐요' : '수정 완료 표시를 풀었어요')
    } catch (e) {
      toast((e as Error).message)
    }
  }
  const ytId = sheet.audio_url ? youtubeId(sheet.audio_url) : null
  const hasFile = Boolean(sheet.audio_path && audio)
  const playingYt = Boolean(ytId) && (!hasFile || source === 'youtube')
  const hasPlayer = hasFile || Boolean(ytId)
  const isExternal = !hasFile && Boolean(sheet.audio_url) && !ytId
  const fileIsVideo = Boolean(sheet.audio_path && isVideoSrc(sheet.audio_path))
  // 영상(유튜브·mp4)과 같이 볼 때는 화면을 나눠 쓴다: 줄은 읽기 좋은 크기로 스크롤, 지금 줄을 따라감
  const withVideo = playingYt || (hasFile && fileIsVideo)

  // 노래 동기화(저장된 줄별 시각): 재생 중인 줄 표시, 줄을 누르면 그 자리로 이동
  const savedEvents = eventsOf(sheet.sync, playingYt ? 'yt' : 'file')
  const hasSaved = savedEvents.length > 0
  // 유튜브는 저장된 게 없어도 "영상 시작과 동시에 1번 줄"을 기본으로 보여 줌
  const events = hasSaved ? savedEvents : playingYt ? defaultEvents(sheet, savedBpm(sheet.sync) ?? bpmFromEvents(sheet, eventsOf(sheet.sync, 'file'))) : []
  const hasSync = events.length > 0
  const activeIndex = hasPlayer && hasSync ? activeLine(events, t) : undefined
  const onLine = (i: number) => {
    // 그 줄이 나오는 시각 중 지금 이후 가장 가까운 것, 없으면 처음 것
    const mine = events.filter((e) => e.line === i)
    const next = mine.find((e) => e.t > t + 0.5) ?? mine[0]
    if (next) player.current?.seek(next.t, true)
  }
  const clearSync = async () => {
    if (!confirm(`${playingYt ? '유튜브' : '음원'}용 동기화를 지울까요?`)) return
    try {
      const next = withSync(sheet.sync, playingYt ? 'yt' : 'file', null)
      await updateSync(sheet.id, next)
      setSheet({ ...sheet, sync: next })
      toast('동기화를 지웠어요')
    } catch (e) {
      toast((e as Error).message)
    }
  }

  const removeSheet = async () => {
    const title = sheet.song?.title ?? '이 스텝지'
    if (!confirm(`"${title}" 스텝지를 삭제할까요?\n붙어 있던 음원·사진도 같이 지워지고 되돌릴 수 없어요.`)) return
    if (sheet.finalized && !confirm('⚠️ "수정 완료"로 표시된 스텝지예요. 정말 삭제할까요?')) return
    try {
      await deleteSheet(sheet.id)
      toast('스텝지를 삭제했어요')
      nav(`/folder/${sheet.folder_id}`, { replace: true })
    } catch (e) {
      toast((e as Error).message)
    }
  }

  const openFolders = async (mode: 'copy' | 'move') => {
    const fs = await listFolders()
    setFolders(fs.filter((f) => (f.role === 'owner' || f.role === 'editor') && f.id !== sheet.folder_id))
    setMenu(mode)
  }
  /** 복사·옮기기. 이 노래에 버전이 여럿이면 물어보고 전부 같은 모양(한 노래 아래 여러 버전)으로 가져감 */
  const doCopyOrMove = async (f: Folder) => {
    const move = menu === 'move'
    const verb = move ? '옮길' : '복사할'
    setBusy(true)
    try {
      const versions = await listVersions(sheet.song_id)
      let targets = [sheet.id]
      if (versions.length > 1 && confirm(`이 노래엔 버전이 ${versions.length}개 있어요.\n${versions.length}개 모두 함께 ${verb}까요?\n(취소하면 이 버전만)`)) targets = versions.map((v) => v.id)
      let ok = 0
      let dup = 0
      let lastId = ''
      for (const id of targets) {
        try {
          const saved = move ? await moveSheet(id, f.id) : await copySheet(id, f.id)
          ok++
          if (id === sheet.id || !lastId) lastId = saved.id
        } catch (e) {
          if ((e as Error).message === 'DUPLICATE') dup++
          else throw e
        }
      }
      setMenu(null)
      const where = move ? `"${f.name}" 폴더로 옮겼어요` : `"${f.name}" 폴더에 복사했어요`
      if (!ok) {
        toast('저쪽 폴더에 같은 스텝지가 이미 있어서 그대로 뒀어요')
        return
      }
      toast(targets.length > 1 ? `${ok}개 ${where}${dup ? ` · ${dup}개는 이미 있어서 건너뛰었어요` : ''}` : where)
      nav(`/sheet/${lastId}`, { replace: move })
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const editMemo = async () => {
    if (sheet.finalized && !confirm('⚠️ "수정 완료"로 표시된 스텝지예요. 비고를 고칠까요? (수정 완료 표시는 그대로 둬요)')) return
    const memo = prompt('비고 (예: Y스텝시 손동작 있음)', sheet.memo ?? '')
    if (memo === null) return
    try {
      await updateMemo(sheet.id, memo.trim())
      setSheet({ ...sheet, memo: memo.trim() })
      toast(memo.trim() ? '비고를 저장했어요' : '비고를 지웠어요')
    } catch (e) {
      toast((e as Error).message)
    }
  }

  const share = async () => {
    const url = window.location.href
    const text = `${sheet.song?.title ?? ''} 스텝지 (창작 ${sheet.creator_name})`
    if (navigator.share) await navigator.share({ title: text, url }).catch(() => undefined)
    else {
      await navigator.clipboard.writeText(url)
      toast('링크를 복사했어요. 카카오톡에 붙여 넣으세요.')
    }
  }

  const syncBtn = (
    <>
      {hasFile && ytId && (
        <div className="srcseg" role="group" aria-label="재생할 것">
          <button type="button" className={source === 'file' ? 'on' : ''} onClick={() => setSource('file')}>
            음원
          </button>
          <button type="button" className={source === 'youtube' ? 'on' : ''} onClick={() => setSource('youtube')}>
            유튜브
          </button>
        </div>
      )}
      {hasPlayer && hasSync && (
        <button type="button" className="btn watch" onClick={() => nav(`/sheet/${sheet.id}/watch`)} data-tour="watch">
          ▶ 따라 보기
        </button>
      )}
      {canEdit && hasPlayer && (
        <button type="button" className={hasSaved ? 'btn sync on' : 'btn sync'} onClick={() => nav(`/sheet/${sheet.id}/sync`)} data-tour="sync">
          {hasSaved ? '동기화 교정' : playingYt ? '동기화 맞추기' : '노래 동기화'}
        </button>
      )}
      {withVideo && (
        <button type="button" className="btn layout" onClick={() => updatePrefs({ videoLayout: sideLayout ? 'top' : 'side' })} aria-label={sideLayout ? '영상을 위로' : '영상을 옆으로'} title={sideLayout ? '위아래로 보기' : '좌우로 보기'}>
          {sideLayout ? <LayoutTop /> : <LayoutSide />}
          <span>{sideLayout ? '위아래' : '좌우'}</span>
        </button>
      )}
    </>
  )

  return (
    <div className={withVideo ? `screen sheet-screen with-video ${sideLayout ? 'side' : 'top'}` : 'screen sheet-screen'}>
      <TopBar
        title={sheet.song?.title ?? ''}
        sub={`${sheet.creator_name}${folder ? ` · ${folder.name}` : ''}`}
        back="/library"
        right={
          <>
            <HelpButton page="sheet" />
            {photos.length > 0 && (
              <button type="button" className={showPhotos ? 'iconbtn on' : 'iconbtn'} aria-label="원본 사진 보기" aria-pressed={showPhotos} onClick={() => setShowPhotos(!showPhotos)}>
                <Photo />
              </button>
            )}
            {canEdit && (
              <button type="button" className="iconbtn" aria-label="수정" onClick={goEdit} data-tour="edit">
                <Edit />
              </button>
            )}
            <button type="button" className={docView ? 'iconbtn on' : 'iconbtn'} aria-label="문서로 보기" aria-pressed={docView} onClick={() => setDocView(!docView)}>
              <Doc />
            </button>
            <button type="button" className="iconbtn" aria-label="더 보기" onClick={() => setMenu('more')} data-tour="more">
              <More />
            </button>
          </>
        }
      />

      <Modal open={menu === 'more'} title="스텝지" onClose={() => setMenu(null)}>
        <button type="button" className="menu-item" onClick={() => { setMenu(null); window.print() }}>
          <span className="ico"><Print /></span>
          <span className="grow"><b>인쇄 / PDF 저장</b><span>A4 한 장 양식으로 출력해요</span></span>
        </button>
        <button type="button" className="menu-item" onClick={() => { setMenu(null); share() }}>
          <span className="ico"><Share /></span>
          <span className="grow"><b>링크 공유</b><span>카카오톡 등으로 이 스텝지 링크를 보내요</span></span>
        </button>
        <button type="button" className="menu-item" onClick={() => openFolders('copy')}>
          <span className="ico"><Copy /></span>
          <span className="grow"><b>다른 폴더로 복사</b><span>원본은 그대로 두고 복사본을 만들어요</span></span>
        </button>
        {canEdit && (
          <button type="button" className="menu-item" onClick={() => openFolders('move')}>
            <span className="ico"><Copy /></span>
            <span className="grow"><b>다른 폴더로 옮기기</b><span>이 폴더에서는 사라지고 저쪽 폴더로 가요</span></span>
          </button>
        )}
        {canEdit && (
          <button type="button" className="menu-item" onClick={() => { setMenu(null); toggleFinalized() }}>
            <span className="ico">{sheet.finalized ? '↩' : '✔'}</span>
            <span className="grow"><b>{sheet.finalized ? '수정 완료 표시 풀기' : '수정 완료로 표시'}</b><span>{sheet.finalized ? '다시 자유롭게 고칠 수 있어요' : '검토가 끝났어요. 이후에 고치려 하면 경고해요'}</span></span>
          </button>
        )}
        {hasSaved && canEdit && (
          <button type="button" className="menu-item" onClick={() => { setMenu(null); clearSync() }}>
            <span className="ico">✕</span>
            <span className="grow"><b>동기화 지우기</b><span>저장된 줄별 시각을 지워요</span></span>
          </button>
        )}
        {canEdit && (
          <button type="button" className="menu-item danger" onClick={() => { setMenu(null); removeSheet() }}>
            <span className="ico">🗑</span>
            <span className="grow"><b>스텝지 삭제</b><span>이 스텝지와 음원·사진을 지워요. 되돌릴 수 없어요</span></span>
          </button>
        )}
      </Modal>
      <Modal open={menu === 'copy' || menu === 'move'} title={menu === 'move' ? '어느 폴더로 옮길까요?' : '어느 폴더로 복사할까요?'} onClose={() => setMenu(null)}>
        {folders.length === 0 && <div className="notice">보낼 수 있는 폴더가 없어요. 편집 권한이 있는 다른 폴더가 필요해요.</div>}
        {folders.map((f) => (
          <button type="button" className="menu-item" key={f.id} disabled={busy} onClick={() => doCopyOrMove(f)}>
            <span className="grow"><b>{f.name}</b><span>{f.kind === 'shared' ? '공유 폴더' : '내 폴더'}{busy ? ' · 처리 중…' : ''}</span></span>
          </button>
        ))}
      </Modal>

      <Tour
        name="sheet"
        ready={Boolean(folder)}
        steps={[
          { sel: '[data-tour="sync"]', title: '노래에 맞추기', desc: '여기서 AI가 노래를 듣고 줄마다 시작을 찾아요. 맞춰 두면 재생할 때 지금 추는 줄이 표시돼요.' },
          { sel: '[data-tour="edit"]', title: '고치기', desc: '글자가 틀렸거나 줄을 바꾸고 싶으면 연필을 누르세요. 말로 고칠 수도 있어요.' },
          { sel: '[data-tour="final"]', title: '수정 완료', desc: '검토가 끝나면 눌러 두세요. 그 뒤로 고치려 하면 먼저 물어봐요.' },
          { sel: '[data-tour="more"]', title: '더 보기', desc: '인쇄, 링크 공유, 다른 폴더로 복사·옮기기가 여기 있어요.' },
        ]}
      />
      {sheet.finalized ? (
        <div className="final-chip no-print">
          <span className="grow">✔ 수정 완료 · 검토가 끝난 스텝지예요{canEdit ? '. 고치려면 한 번 더 물어봐요' : ''}</span>
          {hasPlayer && hasSync && (
            <button type="button" className="btn tiny primary" onClick={() => nav(`/sheet/${sheet.id}/watch`)}>
              ▶ 따라 보기
            </button>
          )}
          {canEdit && (
            <button type="button" className="btn tiny" onClick={toggleFinalized}>
              표시 풀기
            </button>
          )}
        </div>
      ) : (
        canEdit && (
          <div className="final-row no-print">
            <span className="grow">검토가 끝났으면 표시해 두세요. 이후 고치려 하면 경고해요.</span>
            <button type="button" className="btn tiny final-btn" onClick={toggleFinalized} data-tour="final">
              ✔ 수정 완료
            </button>
          </div>
        )
      )}

      {showPhotos ? (
        <div className="content">
          {photos.map((p, i) => (
            <img key={i} src={p} alt={`원본 사진 ${i + 1}`} className="photo-view" />
          ))}
        </div>
      ) : docView ? (
        <DocView>
          <h2 className="print-title">셔플댄스 스텝지</h2>
          <SheetTable title={sheet.song?.title ?? ''} artist={sheet.song?.artist ?? ''} creator={sheet.creator_name} creatorInfo={sheet.creator_info} lines={sheet.lines} memo={sheet.memo} />
        </DocView>
      ) : withVideo ? (
        <FollowBox activeIndex={activeIndex}>
          <SheetTable title={sheet.song?.title ?? ''} artist={sheet.song?.artist ?? ''} creator={sheet.creator_name} creatorInfo={sheet.creator_info} lines={sheet.lines} memo={sheet.memo} noHead onMemo={canEdit ? editMemo : undefined} activeIndex={activeIndex} onLine={hasSync ? onLine : undefined} />
        </FollowBox>
      ) : (
        <FitBox big={big} setBig={setBig}>
          <h2 className="print-title">셔플댄스 스텝지</h2>
          <SheetTable title={sheet.song?.title ?? ''} artist={sheet.song?.artist ?? ''} creator={sheet.creator_name} creatorInfo={sheet.creator_info} lines={sheet.lines} memo={sheet.memo} big={big} onMemo={canEdit ? editMemo : undefined} activeIndex={activeIndex} onLine={hasSync ? onLine : undefined} />
        </FitBox>
      )}

      {playingYt && ytId && <YouTubePlayer videoId={ytId} name={sheet.song?.title ?? ''} onTime={setT} handle={player} extra={syncBtn} />}
      {hasFile && !playingYt && <Player src={audio} name={sheet.song?.title ?? ''} video={fileIsVideo} onTime={setT} handle={player} extra={syncBtn} />}
      {isExternal && (
        <div className="bottom no-print">
          <a className="btn block" href={sheet.audio_url!} target="_blank" rel="noreferrer">
            음원 링크 열기
          </a>
        </div>
      )}
    </div>
  )
}

/** 영상과 같이 볼 때: 줄을 원래 크기로 스크롤해서 보여 주고, 지금 줄이 바뀌면 가운데로 따라간다.
 *  사용자가 손으로 넘기는 중(4초)에는 따라가지 않는다 */
function FollowBox({ children, activeIndex }: { children: React.ReactNode; activeIndex?: number }) {
  const box = useRef<HTMLDivElement>(null)
  const userUntil = useRef(0)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const touch = () => (userUntil.current = Date.now() + 4000)
    el.addEventListener('touchstart', touch, { passive: true })
    el.addEventListener('wheel', touch, { passive: true })
    return () => {
      el.removeEventListener('touchstart', touch)
      el.removeEventListener('wheel', touch)
    }
  }, [])
  useEffect(() => {
    if (activeIndex === undefined || Date.now() < userUntil.current) return
    const now = box.current?.querySelector('.line.now') as HTMLElement | null
    now?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeIndex])
  return (
    <div className="content follow" ref={box}>
      {children}
    </div>
  )
}

/** 자식(스텝지)을 남은 화면 높이에 맞게: 짧으면 큰 글씨 모드, 길면 축소해서 스크롤 없이 한 화면에 */
function FitBox({ children, big, setBig }: { children: React.ReactNode; big: boolean; setBig: (b: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState<number>()

  useLayoutEffect(() => {
    const b = box.current
    const i = inner.current
    if (!b || !i) return
    const calc = () => {
      const bh = b.clientHeight
      const ih = i.offsetHeight
      if (!bh || !ih) return
      // 큰 글씨 모드는 높이가 약 1.35배. 여유가 충분하면 켜고, 넘치면 끈다(흔들림 방지용 여유 포함)
      if (!big && ih * 1.45 < bh) return setBig(true)
      if (big && ih > bh * 1.2) return setBig(false)
      const s = Math.min(1, bh / ih)
      setScale(s)
      setHeight(ih * s)
    }
    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(b)
    ro.observe(i)
    return () => ro.disconnect()
  }, [children, big, setBig])

  return (
    <div className="fit" ref={box}>
      <div className="fit-wrap" style={{ height }}>
        <div className="fit-inner" ref={inner} style={{ transform: `scale(${scale})` }}>
          {children}
        </div>
      </div>
    </div>
  )
}

/** 인쇄될 모습 그대로(A4 종이) 화면에서 보기 — 폭에 맞춰 축소, 세로 스크롤 */
function DocView({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => setScale(Math.min(1, (el.clientWidth - 24) / 794))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div className="docview" ref={ref}>
      <div className="paper-wrap" style={{ height: 1123 * scale + 24 }}>
        <div className="paper" style={{ transform: `scale(${scale})` }}>{children}</div>
      </div>
    </div>
  )
}
