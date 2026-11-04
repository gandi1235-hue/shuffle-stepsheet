/** 앱 주소 (해시 라우트 제외) */
export const appUrl = () => window.location.href.split('#')[0]

/** 로그인 전에 받은 초대 코드를 잠시 보관하는 키 (로그인 후 바로 폴더 참여) */
export const PENDING_JOIN = 'pending-join'
/** 폴더 초대 링크: 누르면 앱이 열리고 바로 폴더에 들어감 */
export const joinUrl = (code: string) => `${appUrl()}#/join/${code}`

export const FOLDER_INVITE_TEXT = (folderName: string, code: string) =>
  `[셔플박스] "${folderName}" 폴더에 초대해요 💃
${joinUrl(code)}

링크를 누르고 카카오로 로그인하면 폴더에 바로 들어가요.
홈 화면에 추가하면 앱처럼 열려요 (크롬 ⋮ / 사파리 공유 → 홈 화면에 추가).
(안 되면 앱에서 "초대 코드로 참여" → 코드 ${code})`

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
