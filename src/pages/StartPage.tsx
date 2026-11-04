import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Avatar from '../components/Avatar'
import { Sheet as Modal } from '../components/ui'
import InstallBanner from '../components/InstallBanner'
import Onboarding from '../components/Onboarding'
import { Camera, Chat, Chevron, Folder as FolderIcon, Gear, Music, People, Brand } from '../components/Icons'
import { getProfile, listFolders, recentSheets, unreadCounts, type Profile } from '../lib/api'
import type { Folder, Stepsheet } from '../lib/types'

/** 첫 화면: 어디로 갈지 고르는 메뉴판 */
export default function StartPage() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [recent, setRecent] = useState<Stepsheet[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [pick, setPick] = useState(false)
  const [unread, setUnread] = useState<Map<string, number>>(new Map())
  const nav = useNavigate()

  useEffect(() => {
    listFolders()
      .then((fs) => {
        setFolders(fs)
        unreadCounts(fs.filter((f) => f.kind === 'shared').map((f) => f.id)).then(setUnread)
      })
      .catch(() => undefined)
    recentSheets(2).then(setRecent).catch(() => undefined)
    getProfile().then(setProfile).catch(() => undefined)
  }, [])

  const shared = folders.filter((f) => f.kind === 'shared')
  const unreadTotal = [...unread.values()].reduce((a, b) => a + b, 0)
  /** 멤버 톡: 공유 폴더가 하나면 바로, 여럿이면 고르기, 없으면 공유 폴더 메뉴로 */
  const openChat = () => {
    if (shared.length === 1) nav(`/folder/${shared[0].id}/chat`)
    else if (shared.length > 1) setPick(true)
    else nav('/library?dlg=menu')
  }

  const songs = folders.reduce((n, f) => n + (f.song_count ?? 0), 0)
  const canAdd = folders.some((f) => f.role === 'owner' || f.role === 'editor')

  return (
    <div className="screen">
      <div className="hero">
        <div className="topbar">
          <h1 className="brand"><Brand /></h1>
          <div style={{ display: 'flex', gap: 2 }}>
            <Link to="/profile" className="iconbtn" aria-label="내 프로필">
              <Avatar path={profile?.avatar_path} name={profile?.nickname || profile?.display_name || '나'} userId={profile?.id} size={30} />
            </Link>
            <Link to="/settings" className="iconbtn" aria-label="설정">
              <Gear />
            </Link>
          </div>
        </div>
        <div className="greet">오늘은 어떤 스텝을 출까요?</div>
      </div>
      <div className="content">
        <Onboarding />
        <InstallBanner />

        <div className="menu-grid">
          <Link to="/library" className="tile big">
            <span className="tile-ico">
              <FolderIcon />
            </span>
            <span className="tile-title">스텝지함</span>
            <span className="tile-desc">
              저장된 스텝지 보기·검색
              {songs > 0 && ` · ${songs}곡`}
            </span>
          </Link>
          <Link to={canAdd ? '/add' : '/library'} className="tile big accent">
            <span className="tile-ico">
              <Camera />
            </span>
            <span className="tile-title">새 스텝지 등록</span>
            <span className="tile-desc">사진 찍어서 바로 올리기</span>
          </Link>
          <Link to="/library?dlg=menu" className="tile">
            <span className="tile-ico">
              <People />
            </span>
            <span className="tile-title">공유 폴더</span>
            <span className="tile-desc">만들기 · 초대 코드로 참여</span>
          </Link>
          <button type="button" className="tile" onClick={openChat}>
            <span className="tile-ico">
              <Chat />
              {unreadTotal > 0 && <span className="badge">{unreadTotal > 99 ? '99+' : unreadTotal}</span>}
            </span>
            <span className="tile-title">멤버 톡</span>
            <span className="tile-desc">{unreadTotal > 0 ? `새 메시지 ${unreadTotal}개` : shared.length ? (shared.length === 1 ? `${shared[0].name} 멤버들과 대화` : `${shared.length}개 폴더 · 골라서 들어가기`) : '공유 폴더에 들어가면 쓸 수 있어요'}</span>
          </button>
        </div>

        <Modal open={pick} title="어느 폴더 톡으로 갈까요?" onClose={() => setPick(false)}>
          {shared.map((f) => (
            <Link key={f.id} to={`/folder/${f.id}/chat`} className="card" onClick={() => setPick(false)}>
              <span className="ico">
                <Chat />
              </span>
              <span className="grow">
                <span className="t">{f.name}</span>
                {(unread.get(f.id) ?? 0) > 0 && <span className="s">새 메시지 {unread.get(f.id)}개</span>}
              </span>
              {(unread.get(f.id) ?? 0) > 0 ? <span className="badge inline">{unread.get(f.id)}</span> : <Chevron />}
            </Link>
          ))}
        </Modal>

        {recent.length > 0 && (
          <div className="list">
            <div className="label">최근 본 스텝지</div>
            {recent.map((s) => (
              <Link key={s.id} className="card" to={`/sheet/${s.id}`}>
                <span className={s.audio_path || s.audio_url ? 'ico' : 'ico soft'}>
                  <Music />
                </span>
                <span className="grow">
                  <span className="t">{s.song?.title ?? '제목 없음'}</span>
                  <span className="s">
                    {s.song?.artist ? `${s.song.artist} · ` : ''}창작 {s.creator_name}
                  </span>
                </span>
                <Chevron />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
