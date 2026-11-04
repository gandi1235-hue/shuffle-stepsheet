import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Player from '../components/Player'
import SheetTable from '../components/SheetTable'
import TopBar from '../components/TopBar'
import { Skeleton, useToast } from '../components/ui'
import { Edit, Photo, Print, Share } from '../components/Icons'
import { getFolder, getSheet, signedUrl } from '../lib/api'
import type { Folder, Stepsheet } from '../lib/types'

export default function SheetPage() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [sheet, setSheet] = useState<Stepsheet | null>(null)
  const [folder, setFolder] = useState<Folder | null>(null)
  const [audio, setAudio] = useState<string>('')
  const [photos, setPhotos] = useState<string[]>([])
  const [showPhotos, setShowPhotos] = useState(false)
  const [big, setBig] = useState(false)
  const [err, setErr] = useState('')
  const toast = useToast()

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
  const isExternal = !sheet.audio_path && Boolean(sheet.audio_url)

  const share = async () => {
    const url = window.location.href
    const text = `${sheet.song?.title ?? ''} 스텝지 (창작 ${sheet.creator_name})`
    if (navigator.share) await navigator.share({ title: text, url }).catch(() => undefined)
    else {
      await navigator.clipboard.writeText(url)
      toast('링크를 복사했어요. 카카오톡에 붙여 넣으세요.')
    }
  }

  return (
    <div className="screen sheet-screen">
      <TopBar
        title={sheet.song?.title ?? ''}
        sub={`${sheet.creator_name}${folder ? ` · ${folder.name}` : ''}`}
        back="/library"
        right={
          <>
            {photos.length > 0 && (
              <button type="button" className={showPhotos ? 'iconbtn on' : 'iconbtn'} aria-label="원본 사진 보기" aria-pressed={showPhotos} onClick={() => setShowPhotos(!showPhotos)}>
                <Photo />
              </button>
            )}
            {canEdit && (
              <button type="button" className="iconbtn" aria-label="수정" onClick={() => nav(`/edit/${sheet.id}`)}>
                <Edit />
              </button>
            )}
            <button type="button" className="iconbtn" aria-label="인쇄" onClick={() => window.print()}>
              <Print />
            </button>
            <button type="button" className="iconbtn" aria-label="공유" onClick={share}>
              <Share />
            </button>
          </>
        }
      />

      {showPhotos ? (
        <div className="content">
          {photos.map((p, i) => (
            <img key={i} src={p} alt={`원본 사진 ${i + 1}`} className="photo-view" />
          ))}
        </div>
      ) : (
        <FitBox big={big} setBig={setBig}>
          <h2 className="print-title">셔플댄스 스텝지</h2>
          <SheetTable title={sheet.song?.title ?? ''} artist={sheet.song?.artist ?? ''} creator={sheet.creator_name} creatorInfo={sheet.creator_info} lines={sheet.lines} memo={sheet.memo} big={big} />
        </FitBox>
      )}

      {audio && !isExternal && <Player src={audio} name={sheet.song?.title ?? ''} />}
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
