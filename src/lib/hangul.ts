const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
const BASIC: Record<string, string> = { ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ' }

/** 제목 첫 글자의 초성(ㄱㄴㄷ…). 영문은 'A', 숫자·기호는 '#' */
export function initialOf(text: string): string {
  const ch = text.trim().charAt(0)
  if (!ch) return '#'
  const code = ch.charCodeAt(0)
  if (code >= 0xac00 && code <= 0xd7a3) {
    const cho = CHO[Math.floor((code - 0xac00) / 588)]
    return BASIC[cho] ?? cho
  }
  if (/[a-zA-Z]/.test(ch)) return 'A'
  return '#'
}

const ORDER = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ', 'A', '#']
export const initialRank = (k: string) => (ORDER.indexOf(k) === -1 ? ORDER.length : ORDER.indexOf(k))
const LABEL: Record<string, string> = { ㄱ: '가', ㄴ: '나', ㄷ: '다', ㄹ: '라', ㅁ: '마', ㅂ: '바', ㅅ: '사', ㅇ: '아', ㅈ: '자', ㅊ: '차', ㅋ: '카', ㅌ: '타', ㅍ: '파', ㅎ: '하', A: 'ABC', '#': '기타' }
export const initialLabel = (k: string) => LABEL[k] ?? k
export const compareKo = (a: string, b: string) => a.localeCompare(b, 'ko')
