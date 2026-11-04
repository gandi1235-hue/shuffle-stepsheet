import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import InstallBanner from '../components/InstallBanner'
import Onboarding from '../components/Onboarding'
import { Camera, Chevron, Folder as FolderIcon, Gear, Music, People, Brand } from '../components/Icons'
import { listFolders, recentSheets } from '../lib/api'
import type { Folder, Stepsheet } from '../lib/types'

/** 첫 화면: 어디로 갈지 고르는 메뉴판 */
export default function StartPage() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [recent, setRecent] = useState<Stepsheet[]>([])

  useEffect(() => {
    listFolders().then(setFolders).catch(() => undefined)
    recentSheets(3).then(setRecent).catch(() => undefined)
  }, [])

  const songs = folders.reduce((n, f) => n + (f.song_count ?? 0), 0)
  const canAdd = folders.some((f) => f.role === 'owner' || f.role === 'editor')

  return (
    <div className="screen">
      <div className="hero">
        <div className="topbar">
          <h1 className="brand"><Brand /></h1>
          <Link to="/settings" className="iconbtn" aria-label="설정">
            <Gear />
          </Link>
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
          <Link to="/settings" className="tile">
            <span className="tile-ico">
              <Gear />
            </span>
            <span className="tile-title">설정</span>
            <span className="tile-desc">글자 크기 · 고대비 · 계정</span>
          </Link>
        </div>

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
