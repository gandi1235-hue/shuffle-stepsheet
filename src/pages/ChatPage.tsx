import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Avatar from '../components/Avatar'
import TopBar from '../components/TopBar'
import HelpButton from '../components/HelpButton'
import { Sheet as Modal, useToast } from '../components/ui'
import { deleteMessage, getFolder, listMembers, listMessages, markRead, sendMessage, subscribeMessages, type Member, type Message } from '../lib/api'
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

  const remove = async (m: Message) => {
    if (!confirm('이 메시지를 지울까요?')) return
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
                    {!cont && <Avatar path={mem?.avatar_path} name={nameOf(m.user_id)} userId={m.user_id} size={36} />}
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
                    <div className="bubble" onDoubleClick={mine ? () => remove(m) : undefined}>
                      {m.body}
                    </div>
                    {!mine && <span className="msg-time">{timeOf(m.created_at)}</span>}
                  </div>
                </div>
                {mine && (
                  <Link to="/profile" className="msg-who" aria-label="내 프로필 바꾸기" style={{ visibility: cont ? 'hidden' : 'visible' }}>
                    {!cont && <Avatar path={mem?.avatar_path} name={nameOf(m.user_id)} userId={m.user_id} size={36} />}
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
            <Avatar path={detail.avatar_path} name={detail.name} userId={detail.user_id} size={96} />
            <div className="who-name">{detail.name}</div>
            <div className="who-real">본명 {detail.display_name || '(없음)'}</div>
            <span className="chip accent">{detail.role === 'owner' ? '주인' : detail.role === 'editor' ? '편집자' : '보기만'}</span>
          </div>
        )}
      </Modal>
    </div>
  )
}
