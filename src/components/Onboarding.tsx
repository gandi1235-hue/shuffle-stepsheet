import { useState } from 'react'
import { Camera, Music, Shared } from './Icons'

const KEY = 'onboarded'
const SLIDES = [
  { icon: <Camera />, title: '사진 한 장으로 등록', desc: '종이 스텝지나 칠판을 찍으면 AI가 읽어서 협회 양식으로 정리해요. 틀린 글자만 고치고 저장하면 끝.' },
  { icon: <Music />, title: '음원 붙여서 바로 연습', desc: '내가 가진 MP3나 링크를 스텝지에 붙여 두면, 스텝지를 보면서 바로 틀 수 있어요. 느리게 재생도 돼요.' },
  { icon: <Shared />, title: '반 친구들과 공유', desc: '공유 폴더를 만들고 초대 코드를 카카오톡으로 보내면, 같은 스텝지를 모두 함께 봐요.' },
]

/** 처음 열었을 때 한 번만 보이는 3장짜리 안내 */
export default function Onboarding() {
  const [i, setI] = useState(0)
  const [done, setDone] = useState(() => localStorage.getItem(KEY) === '1')
  if (done) return null
  const finish = () => {
    localStorage.setItem(KEY, '1')
    setDone(true)
  }
  const s = SLIDES[i]
  const last = i === SLIDES.length - 1
  return (
    <div className="scrim center">
      <div className="onboard" role="dialog" aria-modal="true" aria-label="처음 사용 안내">
        <div className="onboard-ico">{s.icon}</div>
        <h2>{s.title}</h2>
        <p>{s.desc}</p>
        <div className="dots" aria-hidden="true">
          {SLIDES.map((_, k) => (
            <span key={k} className={k === i ? 'on' : ''} />
          ))}
        </div>
        <div className="onboard-actions">
          {!last && (
            <button type="button" className="btn" onClick={finish}>
              건너뛰기
            </button>
          )}
          <button type="button" className="btn primary" onClick={() => (last ? finish() : setI(i + 1))}>
            {last ? '시작하기' : '다음'}
          </button>
        </div>
      </div>
    </div>
  )
}
