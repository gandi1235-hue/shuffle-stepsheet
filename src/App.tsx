import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ToastProvider } from './components/ui'
import { AuthProvider, useAuth } from './lib/auth'
import { applyPrefs, loadPrefs } from './lib/prefs'
import AddPage from './pages/AddPage'
import FolderPage from './pages/FolderPage'
import Home from './pages/Home'
import Login from './pages/Login'
import MembersPage from './pages/MembersPage'
import SettingsPage from './pages/SettingsPage'
import SheetPage from './pages/SheetPage'
import StartPage from './pages/StartPage'

applyPrefs(loadPrefs())

function Gate() {
  const { session, loading } = useAuth()
  if (loading) return <div className="spinner">불러오는 중…</div>
  if (!session) return <Login />
  return (
    <Routes>
      <Route path="/" element={<StartPage />} />
      <Route path="/library" element={<Home />} />
      <Route path="/folder/:id" element={<FolderPage />} />
      <Route path="/folder/:id/members" element={<MembersPage />} />
      <Route path="/sheet/:id" element={<SheetPage />} />
      <Route path="/add" element={<AddPage />} />
      <Route path="/edit/:id" element={<AddPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <ToastProvider>
          <div className="app">
            <Gate />
          </div>
        </ToastProvider>
      </HashRouter>
    </AuthProvider>
  )
}
