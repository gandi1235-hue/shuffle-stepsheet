import { useRef, useState } from 'react'
import { ONBOARD_KEY } from '../lib/tour'

const CARDS = [
  { emoji: '👋', bg: 'linear-gradient(135deg, #ff5f8f, #d9376e)', title: '셔플박스에 어서 오세요', desc: '스텝지와 음원을 한곳에. 종이 스텝지를 찍어 올리고, 노래를 틀면 지금 추는 줄이 따라와요.' },
  { emoji: '📸', bg: 'linear-gradient(135deg, #ff9a3c, #ff5f8f)', title: '사진 한 장이면 등록 끝', desc: '종이 스텝지나 칠판을 찍으면 AI가 읽어서 양식대로 정리해요. 틀린 글자만 고치고 저장하면 돼요.' },
  { emoji: '🎵', bg: 'linear-gradient(135deg, #7c4dff, #d9376e)', title: '스텝지 보며 바로 연습', desc: 'MP3나 유튜브 링크를 붙여 두면 스텝지 아래에서 바로 틀어요. 느리게 재생, 구간 반복도 돼요.' },
  { emoji: '🤖', bg: 'linear-gradient(135deg, #00b8a9, #2d7ff9)', title: 'AI가 박자를 맞춰 줘요', desc: '"AI로 맞추기" 한 번이면 AI가 노래를 듣고(영상은 보고) 줄마다 시작을 찾아요. 재생하면 지금 줄이 표시돼요.' },
  { emoji: '👥', bg: 'linear-gradient(135deg, #2d7ff9, #7c4dff)', title: '반 친구들과 함께', desc: '공유 폴더를 만들어 초대 코드를 카톡으로 보내면 같은 스텝지를 모두 함께 봐요. 멤버 톡도 있어요.' },
  { emoji: '✔️', bg: 'linear-gradient(135deg, #43a047, #00b8a9)', title: '검토 끝나면 수정 완료', desc: '다 맞다 싶으면 "수정 완료"를 눌러 두세요. 누가 고치려 하면 먼저 물어봐요. 이제 화면을 둘러볼까요?' },
]

/** 처음 열었을 때 한 번만 보이는 카드뉴스 (넘기거나 밀어서 보기). 끝나면 화면 둘러보기로 이어짐 */
export default function Onboarding({ onDone }: { onDone?: () => void }) {
  const [i, setI] = useState(0)
  const [done, setDone] = useState(() => localStorage.getItem(ONBOARD_KEY) === '1')
  const touchX = useRef<number | null>(null)
  if (done) return null
  const finish = () => {
    localStorage.setItem(ONBOARD_KEY, '1')
    setDone(true)
    onDone?.()
  }
  const c = CARDS[i]
  const last = i === CARDS.length - 1
  const go = (d: number) => setI((k) => Math.max(0, Math.min(CARDS.length - 1, k + d)))
  return (
    <div className="scrim center">
      <div
        className="onboard card-news"
        role="dialog"
        aria-modal="true"
        aria-label="처음 사용 안내"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return
          const dx = e.changedTouches[0].clientX - touchX.current
          touchX.current = null
          if (dx < -40) go(1)
          else if (dx > 40) go(-1)
        }}
      >
        <div className="card-art" key={i} style={{ background: c.bg }}>
          <span className="card-emoji" aria-hidden="true">{c.emoji}</span>
          <span className="card-no">{i + 1} / {CARDS.length}</span>
        </div>
        <h2>{c.title}</h2>
        <p>{c.desc}</p>
        <div className="dots" aria-hidden="true">
          {CARDS.map((_, k) => (
            <span key={k} className={k === i ? 'on' : ''} />
          ))}
        </div>
        <div className="onboard-actions">
          {!last ? (
            <button type="button" className="btn" onClick={finish}>
              건너뛰기
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => go(-1)}>
              이전
            </button>
          )}
          <button type="button" className="btn primary" onClick={() => (last ? finish() : go(1))}>
            {last ? '화면 둘러보기 →' : '다음'}
          </button>
        </div>
      </div>
    </div>
  )
}
