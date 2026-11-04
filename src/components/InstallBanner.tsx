import { useEffect, useState } from 'react'
import { Close } from './Icons'

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
const KEY = 'install-dismissed'

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent)

/** 브라우저 주소창 없이 앱처럼 쓰도록 홈 화면 설치를 안내 */
export default function InstallBanner() {
  const [bip, setBip] = useState<BIP | null>(null)
  const [hidden, setHidden] = useState(() => isStandalone() || localStorage.getItem(KEY) === '1')

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setBip(e as BIP)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', () => setHidden(true))
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (hidden) return null

  const dismiss = () => {
    localStorage.setItem(KEY, '1')
    setHidden(true)
  }
  const install = async () => {
    if (!bip) return
    await bip.prompt()
    const { outcome } = await bip.userChoice
    if (outcome === 'accepted') setHidden(true)
  }

  return (
    <div className="install">
      <div className="grow">
        <b>앱처럼 쓰기</b>
        {bip ? (
          <span>홈 화면에 설치하면 주소창 없이 전체 화면으로 열려요.</span>
        ) : isIOS() ? (
          <span>
            사파리 아래 <b>공유</b> 버튼 → <b>홈 화면에 추가</b>를 누르면 주소창 없이 앱처럼 열려요.
          </span>
        ) : (
          <span>
            브라우저 메뉴(⋮) → <b>홈 화면에 추가</b>(또는 앱 설치)를 누르면 주소창 없이 앱처럼 열려요.
          </span>
        )}
      </div>
      {bip && (
        <button type="button" className="btn primary" style={{ minHeight: 40, fontSize: 15 }} onClick={install}>
          설치
        </button>
      )}
      <button type="button" className="iconbtn" aria-label="닫기" onClick={dismiss}>
        <Close />
      </button>
    </div>
  )
}
