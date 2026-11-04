import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import UpdateBanner from './components/UpdateBanner'
import LevelUpWatcher from './components/LevelUp'
import { ToastProvider } from './components/ui'
import { AuthProvider, useAuth } from './lib/auth'
import { applyPrefs, loadPrefs } from './lib/prefs'
import AddPage from './pages/AddPage'
import FolderPage from './pages/FolderPage'
import Home from './pages/Home'
import Login from './pages/Login'
import MembersPage from './pages/MembersPage'
import FolderEditPage from './pages/FolderEditPage'
import ChatPage from './pages/ChatPage'
import SyncPage from './pages/SyncPage'
import SettingsPage from './pages/SettingsPage'
import ProfilePage from './pages/ProfilePage'
import SheetPage from './pages/SheetPage'
import StartPage from './pages/StartPage'
import JoinPage from './pages/JoinPage'
import { PENDING_JOIN } from './lib/share'

applyPrefs(loadPrefs())

function Gate() {
  const { session, loading } = useAuth()
  if (loading) return <div className="spinner">불러오는 중…</div>
  if (!session) {
    // 초대 링크로 왔는데 로그인 전이면 코드를 기억해 두고, 로그인 뒤 바로 폴더로
    const m = window.location.hash.match(/#\/join\/([A-Za-z0-9]+)/)
    if (m) localStorage.setItem(PENDING_JOIN, m[1])
    return <Login />
  }
  const pending = localStorage.getItem(PENDING_JOIN)
  return (
    <>
    <LevelUpWatcher />
    <Routes>
      <Route path="/" element={pending ? <Navigate to={`/join/${pending}`} replace /> : <StartPage />} />
      <Route path="/join/:code" element={<JoinPage />} />
      <Route path="/library" element={<Home />} />
      <Route path="/folder/:id" element={<FolderPage />} />
      <Route path="/folder/:id/members" element={<MembersPage />} />
      <Route path="/folder/:id/edit" element={<FolderEditPage />} />
      <Route path="/folder/:id/chat" element={<ChatPage />} />
      <Route path="/sheet/:id" element={<SheetPage />} />
      <Route path="/sheet/:id/sync" element={<SyncPage />} />
      <Route path="/add" element={<AddPage />} />
      <Route path="/edit/:id" element={<AddPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <ToastProvider>
          <div className="app">
            <UpdateBanner />
            <Gate />
          </div>
        </ToastProvider>
      </HashRouter>
    </AuthProvider>
  )
}
