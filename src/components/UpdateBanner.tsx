import { useRegisterSW } from 'virtual:pwa-register/react'

/** 새 버전이 배포되면 위에 알림을 띄우고, 누르면 바로 새 버전으로 */
export default function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, r) {
      // 1분마다 새 버전이 있는지 확인
      if (r) setInterval(() => r.update(), 60 * 1000)
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
