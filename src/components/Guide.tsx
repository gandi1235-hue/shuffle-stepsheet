import { useEffect, useRef, useState } from 'react'
import { ONBOARD_KEY } from '../lib/tour'

const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent)
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

export type Deck = 'intro' | 'basic' | 'advanced'
type Card = { emoji: string; bg: string; title: string; desc: string; tips?: string[]; hot?: boolean }

const INSTALL_TIPS = () =>
  isStandalone()
    ? ['이미 홈 화면 앱으로 열려 있어요', '궁금한 건 각 화면 오른쪽 위 ? 버튼에 다 있어요']
    : isIOS()
      ? ['① 사파리 아래 공유 버튼(네모에 화살표)', '② "홈 화면에 추가" → 추가', '③ 홈 화면의 ShuffleBox 아이콘으로 열기', '궁금한 건 각 화면 오른쪽 위 ? 버튼에 다 있어요']
      : ['① 크롬 오른쪽 위 ⋮ 메뉴', '② "홈 화면에 추가" 또는 "앱 설치" → 설치', '③ 홈 화면의 ShuffleBox 아이콘으로 열기', '궁금한 건 각 화면 오른쪽 위 ? 버튼에 다 있어요']

/** 처음 설치했을 때 보는 소개 5장 (친구 소개 카드뉴스와 같은 내용) */
const INTRO: Card[] = [
  { emoji: '🗂️', bg: 'linear-gradient(135deg, #ffd1e0, #ffb27a)', title: '스텝지 파일, 너무 많아 못 찾겠죠?', desc: '카톡방에 흩어진 사진·파일 그만 뒤지세요. ShuffleBox에 모아 두면 노래 이름으로 바로 찾아요.', tips: ['곡 이름·창작자로 검색', '내 폴더 / 동호회 폴더로 정리', '같은 곡 여러 버전도 한 묶음'] },
  { emoji: '📷', bg: 'linear-gradient(135deg, #7cc4ff, #b39dff)', title: '찍어도 되고, 있는 파일도 돼요', desc: '종이 스텝지를 바로 찍거나, 카톡으로 받은 사진·캡처를 올리면 AI가 읽어서 줄 단위 스텝지로 만들어요.', tips: ['손글씨·프린트·칠판 다 돼요', '여러 장 한 번에', '틀린 글자는 눌러서 바로 수정'] },
  { emoji: '🎬', bg: 'linear-gradient(135deg, #5fd39b, #ffd166)', title: '영상·음악까지, 싱크로 맞춰 연습', desc: '유튜브 링크, 영상 파일, 음원 파일을 붙이면 AI가 보고 들어서 박자를 맞춰요. 재생하면 지금 출 줄이 따라와요.', tips: ['느리게 재생 · 구간 반복', '줄 누르면 그 자리로 이동', '영상은 스텝지 옆에 두고 보기'] },
  { emoji: '👯', bg: 'linear-gradient(135deg, #ff9a7a, #ff7ab8)', title: '동호회 폴더로 같이 써요', desc: '공유 폴더 만들고 카톡으로 초대하면 멤버 모두 같은 스텝지를 봐요. 한 사람이 올리면 다 같이 보여요.', tips: ['초대 링크 누르면 바로 참여', '수정 완료 표시 · 멤버 톡'] },
  { emoji: '📲', bg: 'linear-gradient(135deg, #d9376e, #7c4dff)', title: '꼭! 앱처럼 설치하세요', desc: isStandalone() ? '홈 화면에 설치가 끝났어요. 이제 바로 시작하면 돼요.' : '홈 화면에 추가하면 주소창 없이 앱처럼 열려요. 1분이면 끝.', tips: INSTALL_TIPS(), hot: true },
]

const BASIC: Card[] = [
  { emoji: '👋', bg: 'linear-gradient(135deg, #ff5f8f, #d9376e)', title: '셔플박스에 어서 오세요', desc: '종이 스텝지와 음원을 한곳에 모아 두는 셔플댄스 연습 앱이에요. 스텝지를 찍어 올리고, 노래를 틀면 지금 추는 줄이 따라와요.', tips: ['첫 화면의 네 칸: 스텝지함 · 새 스텝지 등록 · 공유 폴더 · 멤버 톡', '어느 화면이든 오른쪽 위 ? 를 누르면 그 화면 사용법이 나와요'] },
  { emoji: '📲', bg: 'linear-gradient(135deg, #607d8b, #d9376e)', title: '먼저, 앱처럼 설치해요', desc: isStandalone() ? '이미 홈 화면에 설치돼 있어요. 주소창 없이 전체 화면으로 쓰고 있는 거예요.' : isIOS() ? '사파리에서 열었다면 1분이면 돼요. 홈 화면에 아이콘이 생기고 주소창 없이 전체 화면으로 열려요.' : '크롬에서 열었다면 1분이면 돼요. 홈 화면에 아이콘이 생기고 주소창 없이 전체 화면으로 열려요.', tips: isStandalone() ? ['첫 화면 ? → 기본 사용법에서 나머지를 볼 수 있어요'] : isIOS() ? ['① 사파리 아래 가운데 공유 버튼(네모에 화살표)', '② 아래로 내려 "홈 화면에 추가" → 추가', '③ 홈 화면의 ShuffleBox 아이콘으로 열기'] : ['① 크롬 오른쪽 위 ⋮ 메뉴', '② "홈 화면에 추가" 또는 "앱 설치" → 설치', '③ 홈 화면의 ShuffleBox 아이콘으로 열기 (설정에서도 다시 볼 수 있어요)'] },
  { emoji: '📸', bg: 'linear-gradient(135deg, #ff9a3c, #ff5f8f)', title: '사진 한 장이면 등록 끝', desc: '"새 스텝지 등록"에서 종이 스텝지나 칠판을 찍으면 AI가 읽어서 양식대로 줄을 나눠 줘요. 여러 장도 한 번에 돼요.', tips: ['노란 칸은 AI가 확신 없는 글자예요. 눌러서 고치세요', '제목·창작자만 확인하고 저장하면 끝', '사진 없이 글로 바로 적어도 돼요'] },
  { emoji: '🎵', bg: 'linear-gradient(135deg, #7c4dff, #d9376e)', title: '스텝지 보며 바로 연습', desc: '등록할 때 MP3 파일이나 유튜브 링크를 붙여 두면, 스텝지 아래에 재생기가 붙어요. 보면서 바로 틀 수 있어요.', tips: ['− / + 로 느리게·빠르게 (0.5배까지)', '"구간 반복"으로 어려운 부분만 돌려 듣기', '유튜브는 영상을 위나 옆에 두고 볼 수 있어요'] },
  { emoji: '🤖', bg: 'linear-gradient(135deg, #00b8a9, #2d7ff9)', title: 'AI가 박자를 맞춰 줘요', desc: '스텝지 화면의 "노래 동기화"에 들어가 "AI로 맞추기"를 누르면, AI가 노래를 듣고(영상은 보고) 줄마다 시작 시각을 찾아요.', tips: ['1~3분 걸려요. 다른 화면에 가 있어도 끝나면 자동 저장', '맞춰 두면 재생할 때 지금 줄이 빨갛게 표시되고, 줄을 누르면 그 자리로 이동', '틀린 줄은 그 줄이 시작될 때 눌러서 바로잡아요'] },
  { emoji: '👥', bg: 'linear-gradient(135deg, #2d7ff9, #7c4dff)', title: '반 친구들과 함께', desc: '"공유 폴더"를 만들고 초대 코드를 카카오톡으로 보내면, 같은 스텝지를 모두 함께 봐요. 한 사람이 올리면 모두에게 보여요.', tips: ['초대받은 사람은 링크만 누르면 들어와요', '멤버 톡에서 짧게 대화', '내 스텝지를 공유 폴더로 복사·옮기기도 돼요'] },
  { emoji: '✔️', bg: 'linear-gradient(135deg, #43a047, #00b8a9)', title: '검토 끝나면 수정 완료', desc: '스텝지가 다 맞다 싶으면 위쪽 "✔ 수정 완료"를 눌러 두세요. 목록에 배지가 붙고, 누가 고치려 하면 먼저 물어봐요.', tips: ['표시를 풀면 다시 자유롭게 고칠 수 있어요', '더 알고 싶으면 ? 버튼 → 심화 사용법', '이제 화면을 둘러볼까요?'] },
]

const ADVANCED: Card[] = [
  { emoji: '🎤', bg: 'linear-gradient(135deg, #d9376e, #7c4dff)', title: '말로 고치기', desc: '수정 화면의 "말로 고치기"를 누르고 말하면 AI가 그대로 고쳐요. 타자 안 쳐도 돼요.', tips: ['"3번 줄 티스텝을 런닝맨 4박으로"', '"후렴 첫 줄 지워" / "2번 아래에 찰스턴 8박 넣어"', '"1번 줄에 손동작 해설 양손 빠이빠이"'] },
  { emoji: '📍', bg: 'linear-gradient(135deg, #ff9a3c, #d9376e)', title: '8박 도장 · 반복 도장', desc: '박수가 안 적힌 스텝지는 AI가 한 줄을 8박으로 짐작해요. 수정 화면의 "📍 도장 찍기"로 정확히 알려 주세요.', tips: ['스텝 옆 ┃ : 여기서 한 구절(8박)이 끝남', '스텝 옆 ↻ : 앞 구절을 몇 박 더 반복하는지', '글로는 "찰스턴 | 런닝맨 ↻8"처럼 적어도 돼요'] },
  { emoji: '🧠', bg: 'linear-gradient(135deg, #00b8a9, #43a047)', title: 'AI 맞추기 더 똑똑하게', desc: '동기화 화면 "직접 고치기"를 펼치면 "고급 추론" 스위치가 있어요. 켜면 AI가 더 오래, 더 깊이 생각해요.', tips: ['유튜브: AI가 영상을 처음부터 끝까지 보고 들어요', '음악 파일(m4a·mp3, 14MB까지): AI가 듣고 전주·구절 경계를 찾아요', '반복·쉬기 줄("8박 반복", "4박 쉬기")도 계산에 넣어요'] },
  { emoji: '🗣️', bg: 'linear-gradient(135deg, #2d7ff9, #00b8a9)', title: '말로 요청해서 순서 바꾸기', desc: '영상 순서가 스텝지와 다르면 동기화 화면 "🎤 말로 요청"에 말하세요. 순서·반복·쉬는 박·시작 시각 다 돼요.', tips: ['"2번부터 시작하고 1번은 맨 끝에"', '"후렴을 두 번" / "1번 하고 4박 쉬고 2번"', '"2번은 35초에" / "박자 128"'] },
  { emoji: '👣', bg: 'linear-gradient(135deg, #7c4dff, #2d7ff9)', title: '직접 고치기 (수동)', desc: 'AI가 맞춘 게 어긋나면 손으로도 잡을 수 있어요. 동기화 화면에서 "직접 고치기"를 펼치세요.', tips: ['재생 중 그 줄이 시작될 때 그 줄을 누르면 거기가 시작점 (뒤 줄도 같이 밀려요)', '"박자 찍기": 8박마다 톡톡 찍으면 BPM을 정확히 잡아요', '− / + 로 BPM 미세 조정, "되돌리기"로 한 단계 취소'] },
  { emoji: '🔑', bg: 'linear-gradient(135deg, #43a047, #2d7ff9)', title: '공유 폴더 권한', desc: '폴더 주인은 멤버 목록에서 권한을 정해요. 보기만 할 사람과 고칠 사람을 나눌 수 있어요.', tips: ['주인: 멤버 관리·폴더 이름·없애기', '편집자: 스텝지 올리기·고치기·동기화', '보기만: 스텝지 보기와 톡만'] },
  { emoji: '🖨️', bg: 'linear-gradient(135deg, #ff5f8f, #ff9a3c)', title: '인쇄 · 공유 · 옮기기', desc: '스텝지 화면 오른쪽 위 ⋮ (더 보기) 메뉴에 모여 있어요.', tips: ['인쇄 / PDF 저장: A4 한 장 양식', '링크 공유: 카카오톡으로 스텝지 링크 보내기', '다른 폴더로 복사·옮기기, 스텝지 삭제'] },
  { emoji: '⚙️', bg: 'linear-gradient(135deg, #607d8b, #2d7ff9)', title: '설정에서 할 수 있는 것', desc: '첫 화면 오른쪽 위 톱니바퀴를 누르세요. 눈에 맞게 글자를 키우고, 앱처럼 쓰도록 홈 화면에 추가할 수 있어요.', tips: ['글자 크기 3단계 · 진하게', '홈 화면에 추가하면 주소창 없이 전체 화면', '프로필에서 AI 캐릭터 만들기 · 친구에게 앱 보내기'] },
]

export const DECKS: Record<Deck, { label: string; cards: Card[] }> = {
  intro: { label: '소개', cards: INTRO },
  basic: { label: '기본 사용법', cards: BASIC },
  advanced: { label: '심화 사용법', cards: ADVANCED },
}

/**
 * 사용법 카드뉴스. first=true면 처음 실행 안내(소개 5장, 마지막에 "화면 둘러보기"), 아니면 ? 버튼에서 연 것(소개/기본/심화 탭)
 */
export default function Guide({ first = false, deck: initial = first ? 'intro' : 'basic', onClose }: { deck?: Deck; first?: boolean; onClose: (startTour: boolean) => void }) {
  const [deck, setDeck] = useState<Deck>(initial)
  const [i, setI] = useState(0)
  const touchX = useRef<number | null>(null)
  const cards = DECKS[deck].cards
  const c = cards[i]
  const last = i === cards.length - 1
  useEffect(() => setI(0), [deck])
  const finish = (tour: boolean) => {
    if (first) localStorage.setItem(ONBOARD_KEY, '1')
    onClose(tour)
  }
  const go = (d: number) => setI((k) => Math.max(0, Math.min(cards.length - 1, k + d)))
  return (
    <div className="scrim center" onClick={() => finish(false)}>
      <div
        className={`onboard card-news${c.hot ? ' hot' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="사용법"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return
          const dx = e.changedTouches[0].clientX - touchX.current
          touchX.current = null
          if (dx < -40) go(1)
          else if (dx > 40) go(-1)
        }}
      >
        {!first && (
          <div className="deck-tabs" role="tablist">
            {(Object.keys(DECKS) as Deck[]).map((d) => (
              <button key={d} type="button" role="tab" aria-selected={deck === d} className={deck === d ? 'on' : ''} onClick={() => setDeck(d)}>
                {DECKS[d].label}
              </button>
            ))}
            <button type="button" className="deck-close" aria-label="닫기" onClick={() => finish(false)}>
              ✕
            </button>
          </div>
        )}
        <div className="card-art" key={`${deck}-${i}`} style={{ background: c.bg }}>
          <span className="card-emoji" aria-hidden="true">{c.emoji}</span>
          <span className="card-no">{i + 1} / {cards.length}</span>
        </div>
        <h2>{c.title}</h2>
        <p>{c.desc}</p>
        {c.tips && (
          <ul className="card-tips">
            {c.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
        <div className="dots" aria-hidden="true">
          {cards.map((_, k) => (
            <span key={k} className={k === i ? 'on' : ''} />
          ))}
        </div>
        <div className="onboard-actions">
          {i === 0 ? (
            <button type="button" className="btn" onClick={() => finish(false)}>
              {first ? '건너뛰기' : '닫기'}
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => go(-1)}>
              이전
            </button>
          )}
          {last ? (
            first ? (
              <button type="button" className="btn primary" onClick={() => finish(true)}>
                화면 둘러보기 →
              </button>
            ) : deck === 'intro' ? (
              <button type="button" className="btn primary" onClick={() => setDeck('basic')}>
                기본 사용법 →
              </button>
            ) : deck === 'basic' ? (
              <button type="button" className="btn primary" onClick={() => setDeck('advanced')}>
                심화 사용법 →
              </button>
            ) : (
              <button type="button" className="btn primary" onClick={() => finish(false)}>
                다 봤어요
              </button>
            )
          ) : (
            <button type="button" className="btn primary" onClick={() => go(1)}>
              다음
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
