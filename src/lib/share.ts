/** 앱 주소 (해시 라우트 제외) */
export const appUrl = () => window.location.href.split('#')[0]

export const APP_SHARE_TEXT = () =>
  `[셔플박스] 셔플댄스 스텝지 앱이에요 💃\n${appUrl()}\n\n위 링크를 열고 카카오로 로그인하면 바로 쓸 수 있어요.\n홈 화면에 추가하면 앱처럼 열려요 (아이폰: 사파리 공유 → 홈 화면에 추가 / 안드로이드: 메뉴 ⋮ → 홈 화면에 추가).`

/**
 * 앱 자체를 카카오톡 등으로 보내기.
 * 휴대폰: 공유 창이 열려 카카오톡을 고를 수 있음. PC: 글을 복사해 줌 (true 반환 = 복사됨)
 */
export async function shareApp(): Promise<'shared' | 'copied' | 'failed'> {
  const text = APP_SHARE_TEXT()
  if (navigator.share) {
    try {
      await navigator.share({ title: '셔플박스', text })
      return 'shared'
    } catch {
      return 'failed'
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
