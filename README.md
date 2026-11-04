# 스텝지함 — 셔플댄스 스텝지 앱

셔플댄스 스텝지(스텝 순서표)와 음원을 한곳에 모아, 사진 한 장으로 등록하고 검색해서 바로 틀고, 팀원과 공유하는 웹앱(PWA)입니다. 안드로이드·아이폰·컴퓨터 어디서나 브라우저로 열고 홈 화면에 설치해 씁니다.

## 기능

- 사진(종이·칠판·캡처)을 찍으면 AI가 읽어 표준 양식으로 정리, 확인·수정 후 저장
- 같은 노래에 창작자별로 여러 스텝지 (창작자 이름으로 구분)
- 내가 가진 음원 파일(MP3) 또는 링크를 스텝지에 붙여 바로 재생 (속도 조절, 구간 반복, 크게 보기)
- 노래·가수·창작자·스텝 이름으로 검색
- 개인 폴더 + 공유 폴더 (초대 코드, 주인/편집자/보기 권한)

## 처음 설정 (한 번만)

1. **Supabase 프로젝트 만들기** — https://supabase.com 에서 무료 프로젝트 생성 (지역: Northeast Asia (Seoul)).
2. **DB 만들기** — Supabase 대시보드 > SQL Editor 에 `supabase/schema.sql` 내용을 붙여 넣고 Run.
3. **로그인 설정** — Authentication > Providers
   - Email: 켜기 (매직 링크 로그인)
   - Kakao: 켜기 → 카카오 개발자 콘솔(https://developers.kakao.com)에서 앱 만들고 REST API 키·Client Secret을 넣고, Redirect URI에 Supabase가 보여주는 주소를 등록
   - Authentication > URL Configuration > Site URL 에 배포 주소 입력
4. **사진 인식 함수 배포** — 터미널에서
   ```bash
   npm i -g supabase
   supabase login
   supabase link --project-ref <프로젝트 ref>
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   # https://console.anthropic.com 에서 발급
   supabase functions deploy recognize
   ```
5. **앱 환경변수** — `.env.example`을 `.env`로 복사하고 Supabase URL과 anon key 입력.

## 실행 / 배포

```bash
npm install
npm run dev        # 로컬 확인
npm run build      # dist/ 생성
```

배포는 Vercel 또는 Netlify에 이 저장소를 연결하고, 환경변수 두 개(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)만 넣으면 됩니다. 배포 주소를 카카오톡으로 보내면 회원들이 바로 설치해서 쓸 수 있습니다.

## 폴더 구조

- `src/pages` — 화면 (홈, 폴더, 스텝지 보기, 추가/수정, 멤버)
- `src/components` — 스텝지 표, 재생기 등
- `src/lib/api.ts` — 데이터 읽기·쓰기
- `supabase/schema.sql` — 테이블, 권한(RLS), 저장소 버킷
- `supabase/functions/recognize` — 사진 → 스텝지 JSON (Claude)

## 저작권 안내

앱은 음악을 찾아주거나 내려받지 않습니다. 사용자가 직접 가진 파일이나 링크만 붙입니다. 공유 폴더에 올리는 음원은 비상업적 용도이며 저작권 문제가 없는 파일만 사용해 주세요.
