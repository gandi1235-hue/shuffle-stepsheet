import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Avatar, { Character } from '../components/Avatar'
import { Sheet as Modal } from '../components/ui'
import { FOLDER_INVITE_TEXT } from '../lib/share'
import TopBar from '../components/TopBar'
import { useToast } from '../components/ui'
import { getFolder, listMembers, removeMember, setMemberRole, sheetCounts, transferOwner, type Member } from '../lib/api'
import { levelLabel, levelOf } from '../lib/level'
import { useAuth } from '../lib/auth'
import type { Folder, Role } from '../lib/types'

export default function MembersPage() {
  const { id = '' } = useParams()
  const { session } = useAuth()
  const [folder, setFolder] = useState<Folder | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [err, setErr] = useState('')
  const [detail, setDetail] = useState<Member | null>(null)
  const [counts, setCounts] = useState<Map<string, number>>(new Map())
  const lv = (uid: string) => levelOf(counts.get(uid) ?? 0)
  const toast = useToast()

  const load = () => listMembers(id).then(setMembers).catch((e) => setErr(e.message))
  useEffect(() => {
    getFolder(id).then(setFolder)
    load()
    sheetCounts().then(setCounts).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const isOwner = folder?.role === 'owner'
  const invite = async () => {
    if (!folder?.invite_code) return
    const text = FOLDER_INVITE_TEXT(folder.name, folder.invite_code)
    if (navigator.share) await navigator.share({ text }).catch(() => undefined)
    else {
      await navigator.clipboard.writeText(text)
      toast('초대 글을 복사했어요. 카카오톡에 붙여 넣으세요.')
    }
  }

  const change = async (m: Member, role: Role) => {
    try {
      await setMemberRole(id, m.user_id, role)
      load()
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const handOver = async (m: Member) => {
    if (!confirm(`${m.name} 님을 이 폴더의 주인으로 바꿀까요?\n나는 편집자가 되고, 멤버 초대·내보내기는 새 주인만 할 수 있어요.`)) return
    try {
      await transferOwner(id, m.user_id)
      toast(`${m.name} 님이 주인이 됐어요`)
      getFolder(id).then(setFolder)
      load()
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const kick = async (m: Member) => {
    if (!confirm(`${m.name} 님을 폴더에서 내보낼까요?`)) return
    await removeMember(id, m.user_id)
    load()
  }

  return (
    <div className="screen">
      <TopBar title="멤버" sub={`${folder?.name ?? ''} · ${members.length}명`} back={`/folder/${id}`} />
      <div className="content">
        <Link to={`/folder/${id}/chat`} className="btn block">
          💬 멤버 톡 열기
        </Link>
        {isOwner && (
          <>
            <button type="button" className="btn primary block" onClick={invite}>
              카카오톡으로 초대하기
            </button>
            <div className="notice">
              초대 코드 <b>{folder?.invite_code}</b> · 새로 들어온 사람은 "보기" 권한으로 시작해요. 아래에서 편집자로 바꾸거나, 폴더 주인을 다른 분께 넘길 수 있어요.
            </div>
          </>
        )}
        {err && <div className="error">{err}</div>}
        <div>
          {members.map((m) => (
            <div className="member" key={m.user_id}>
              <button type="button" className="nm who" onClick={() => setDetail(m)} title="자세히">
                <Avatar path={m.avatar_path} name={m.name} userId={m.user_id} size={40} level={lv(m.user_id)} />
                <span>
                  {m.name}
                  {m.user_id === session?.user.id && <span style={{ color: 'var(--faint)', fontSize: 14 }}> (나)</span>}
                </span>
              </button>
              {isOwner && m.role !== 'owner' ? (
                <>
                  <select aria-label="권한" value={m.role} onChange={(e) => change(m, e.target.value as Role)}>
                    <option value="editor">편집자</option>
                    <option value="viewer">보기만</option>
                  </select>
                  <button type="button" className="btn" style={{ minHeight: 40 }} onClick={() => handOver(m)}>
                    주인으로
                  </button>
                  <button type="button" className="btn danger" style={{ minHeight: 40 }} onClick={() => kick(m)}>
                    내보내기
                  </button>
                </>
              ) : (
                <span className="chip accent">{m.role === 'owner' ? '주인' : m.role === 'editor' ? '편집자' : '보기만'}</span>
              )}
            </div>
          ))}
        </div>

        <div className="panel-desc" style={{ marginTop: 18 }}>
          이름을 누르면 본명과 레벨이 보여요. 레벨은 만든 스텝지 수로 올라요(1장 = Lv.2, Lv.5 2급강사, Lv.10 1급강사). 내 닉네임·아바타는 <Link to="/settings">설정</Link>에서 바꿔요. 폴더 이름 바꾸기·없애기·나가기는 <Link to={`/folder/${id}/edit`}>폴더 편집</Link>에서 해요.
        </div>
      </div>

      <Modal open={!!detail} title="멤버 정보" onClose={() => setDetail(null)}>
        {detail && (
          <div className="who-card">
            <Character path={detail.avatar_path} name={detail.name} userId={detail.user_id} width={108} />
            <div className="who-name">{detail.name}</div>
            <span className="chip lv">{levelLabel(lv(detail.user_id))} · 스텝지 {counts.get(detail.user_id) ?? 0}장</span>
            <div className="who-real">본명 {detail.display_name || '(없음)'}{detail.nickname.trim() ? '' : ' · 닉네임 없음'}</div>
            <span className="chip accent">{detail.role === 'owner' ? '주인' : detail.role === 'editor' ? '편집자' : '보기만'}</span>
          </div>
        )}
      </Modal>
    </div>
  )
}
