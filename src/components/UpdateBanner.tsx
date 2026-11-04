import { useRegisterSW } from 'virtual:pwa-register/react'

/** 입력 중인 화면이면 새 버전을 바로 적용하지 않고 알림만 */
const editing = () => /#\/(add|edit)/.test(window.location.hash)

/**
 * 새 버전이 배포되면 모두의 앱에 자동 반영.
 * - 앱을 열 때, 다시 돌아올 때, 1분마다 새 버전 확인
 * - 새 버전이 있으면 바로 새로고침 (스텝지 입력 중일 때만 알림을 띄우고 기다림)
 */
export default function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, r) {
      if (!r) return
      setInterval(() => r.update(), 60 * 1000)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') r.update()
      })
    },
    onNeedRefresh() {
      if (!editing()) updateServiceWorker(true)
    },
  })
  if (!needRefresh) return null
  return (
    <div className="update" role="status">
      <span>새 버전이 있어요</span>
      <button type="button" className="btn" onClick={() => updateServiceWorker(true)}>
        새로고침
      </button>
      <button type="button" className="iconbtn" aria-label="나중에" onClick={() => setNeedRefresh(false)}>
        ✕
      </button>
    </div>
  )
}
