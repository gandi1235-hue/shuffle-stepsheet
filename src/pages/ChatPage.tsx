import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Avatar from '../components/Avatar'
import TopBar from '../components/TopBar'
import HelpButton from '../components/HelpButton'
import { Sheet as Modal, useToast } from '../components/ui'
import { deleteMessage, getFolder, listMembers, listMessages, markRead, sendMessage, sheetCounts, subscribeMessages, type Member, type Message } from '../lib/api'
import { levelOf } from '../lib/level'
import { useAuth } from '../lib/auth'
import type { Folder } from '../lib/types'

const timeOf = (iso: string) => {
  const d = new Date(iso)
  return `${d.getHours() < 12 ? '오전' : '오후'} ${((d.getHours() + 11) % 12) + 1}:${d.getMinutes().toString().padStart(2, '0')}`
}
const dayOf = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

/** 폴더 멤버끼리 쓰는 톡. 실시간으로 오고, 이름을 누르면 본명이 보여요 */
export default function ChatPage() {
  const { id = '' } = useParams()
  const { session } = useAuth()
  const me = session?.user.id
  const toast = useToast()
  const [folder, setFolder] = useState<Folder | null>(null)
  const [members, setMembers] = useState<Record<string, Member>>({})
  const [counts, setCounts] = useState<Map<string, number>>(new Map())
  useEffect(() => {
    sheetCounts().then(setCounts).catch(() => undefined)
  }, [])
  const lvOf = (uid: string) => levelOf(counts.get(uid) ?? 0)
  const [msgs, setMsgs] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [detail, setDetail] = useState<Member | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const membersRef = useRef(members)
  membersRef.current = members

  const loadMembers = () =>
    listMembers(id)
      .then((ms) => setMembers(Object.fromEntries(ms.map((m) => [m.user_id, m]))))
      .catch(() => undefined)

  useEffect(() => {
    getFolder(id).then(setFolder)
    loadMembers()
    listMessages(id)
      .then((ms) => {
        setMsgs(ms)
        markRead(id)
      })
      .catch((e) => setErr(e.message))
    const off = subscribeMessages(id, (m) => {
      setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]))
      markRead(id)
      if (!membersRef.current[m.user_id]) loadMembers()
    }, (gone) => {
      setMsgs((cur) => cur.filter((x) => x.id !== gone))
    })
    return () => {
      markRead(id)
      off()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // 새 메시지가 오면 맨 아래로
  useEffect(() => {
    const el = list.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs.length])

  const send = async () => {
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    try {
      const m = await sendMessage(id, body)
      setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]))
      setText('')
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const owner = folder?.role === 'owner'
  /** 내 메시지는 누구나, 남의 메시지는 폴더 주인만 (길게 누르기 또는 두 번 누르기) */
  const remove = async (m: Message) => {
    const mine = m.user_id === me
    if (!mine && !owner) return
    if (!confirm(mine ? '이 메시지를 지울까요?' : `${nameOf(m.user_id)}님의 메시지를 지울까요? (주인 권한)`)) return
    try {
      await deleteMessage(m.id)
      setMsgs((cur) => cur.filter((x) => x.id !== m.id))
    } catch (e) {
      toast((e as Error).message)
    }
  }

  const nameOf = (uid: string) => members[uid]?.name ?? '멤버'
  let lastDay = ''

  return (
    <div className="screen chat-screen">
      <TopBar title={`${folder?.name ?? ''} 톡`} sub={`멤버 ${Object.keys(members).length}명`} back={`/folder/${id}`} right={<><Link to={`/folder/${id}/members`} className="btn pill" style={{ minHeight: 38 }}>멤버</Link><HelpButton page="chat" /></>} />
      <div className="chat-list" ref={list}>
        {err && <div className="error">{err}</div>}
        {msgs.length === 0 && !err && <div className="empty">아직 메시지가 없어요. 첫 인사를 남겨 보세요.</div>}
        {msgs.map((m, i) => {
          const day = dayOf(m.created_at)
          const showDay = day !== lastDay
          lastDay = day
          const mine = m.user_id === me
          const prev = msgs[i - 1]
          const cont = !showDay && prev && prev.user_id === m.user_id && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 3 * 60 * 1000
          const mem = members[m.user_id]
          return (
            <div key={m.id}>
              {showDay && <div className="chat-day">{day}</div>}
              <div className={`msg ${mine ? 'mine' : ''} ${cont ? 'cont' : ''}`}>
                {!mine && (
                  <button type="button" className="msg-who" onClick={() => mem && setDetail(mem)} aria-label={`${nameOf(m.user_id)} 정보`}>
                    {!cont && <Avatar path={mem?.avatar_path} tiers={mem?.avatar_tiers} level={lvOf(m.user_id)} badge={false} name={nameOf(m.user_id)} userId={m.user_id} size={36} />}
                  </button>
                )}
                <div className="msg-body">
                  {mine && !cont && <span className="msg-name mine-name">{nameOf(m.user_id)}</span>}
                  {!mine && !cont && (
                    <button type="button" className="msg-name" onClick={() => mem && setDetail(mem)}>
                      {nameOf(m.user_id)}
                    </button>
                  )}
                  <div className="msg-row">
                    {mine && <span className="msg-time">{timeOf(m.created_at)}</span>}
                    <Bubble text={m.body} onRemove={mine || owner ? () => remove(m) : undefined} />
                    {!mine && <span className="msg-time">{timeOf(m.created_at)}</span>}
                  </div>
                </div>
                {mine && (
                  <Link to="/profile" className="msg-who" aria-label="내 프로필 바꾸기" style={{ visibility: cont ? 'hidden' : 'visible' }}>
                    {!cont && <Avatar path={mem?.avatar_path} tiers={mem?.avatar_tiers} level={lvOf(m.user_id)} badge={false} name={nameOf(m.user_id)} userId={m.user_id} size={36} />}
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <form
        className="chatbar"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <textarea
          aria-label="메시지"
          rows={1}
          value={text}
          placeholder="메시지 쓰기"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send()
            }
          }}
        />
        <button type="submit" className="btn primary" disabled={busy || !text.trim()}>
          보내기
        </button>
      </form>

      <Modal open={!!detail} title="멤버 정보" onClose={() => setDetail(null)}>
        {detail && (
          <div className="who-card">
            <Avatar path={detail.avatar_path} tiers={detail.avatar_tiers} level={lvOf(detail.user_id)} badge={false} name={detail.name} userId={detail.user_id} size={96} />
            <div className="who-name">{detail.name}</div>
            <div className="who-real">본명 {detail.display_name || '(없음)'}</div>
            <span className="chip accent">{detail.role === 'owner' ? '주인' : detail.role === 'editor' ? '편집자' : '보기만'}</span>
          </div>
        )}
      </Modal>
    </div>
  )
}

/** 말풍선: 지울 수 있으면(내 것·주인) 길게 누르거나 두 번 눌러 지움 */
function Bubble({ text, onRemove }: { text: string; onRemove?: () => void }) {
  const timer = useRef<number | null>(null)
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }
  const origin = useRef<{ x: number; y: number } | null>(null)
  const start = (e: React.PointerEvent) => {
    if (!onRemove) return
    clear()
    origin.current = { x: e.clientX, y: e.clientY }
    timer.current = window.setTimeout(() => {
      timer.current = null
      onRemove()
    }, 600)
  }
  // 손가락이 10px 넘게 움직이면(스크롤) 길게 누르기 취소
  const move = (e: React.PointerEvent) => {
    const o = origin.current
    if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > 10) clear()
  }
  return (
    <div
      className={`bubble${onRemove ? ' can-del' : ''}`}
      onDoubleClick={onRemove}
      onPointerDown={start}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onPointerMove={move}
      onContextMenu={onRemove ? (e) => e.preventDefault() : undefined}
    >
      {text}
    </div>
  )
}
