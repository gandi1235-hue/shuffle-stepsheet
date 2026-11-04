import { usePrefs } from '../lib/prefs'

/** AI 고급 추론 스위치: 기본은 빠른 모델, 켜면 가장 좋은 모델이 오래 생각(xhigh). 설정은 기기에 저장 */
export default function DeepToggle({ note }: { note?: string }) {
  const [prefs, setPrefs] = usePrefs()
  const on = prefs.deepAi === true
  return (
    <label className={on ? 'deep-toggle on' : 'deep-toggle'}>
      <input type="checkbox" checked={on} onChange={(e) => setPrefs({ deepAi: e.target.checked })} />
      <span className="deep-box" aria-hidden="true" />
      <span className="deep-text">
        🧠 고급 추론 {on ? '켬' : '끔'}
        <small>{on ? '가장 좋은 모델이 오래 생각해요 (느리지만 똑똑)' : note ?? '빠른 모델로 바로 답해요. 복잡한 요청이면 켜 보세요'}</small>
      </span>
    </label>
  )
}
