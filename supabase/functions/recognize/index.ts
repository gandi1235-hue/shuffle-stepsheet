// Supabase Edge Function: 사진 → 셔플박스 표준 양식 스텝지 JSON (비정형 스텝지도 내용을 빠뜨리지 않고 옮김)
// 대시보드 Edge Functions > Deploy a new function > Via Editor 에서 이름 "recognize"로 이 파일 내용을 붙여 넣어 배포합니다.
// 비밀키(Edge Functions > Secrets) 중 하나만 넣으면 됩니다:
//   GEMINI_API_KEY    : Google AI Studio 무료 키 (https://aistudio.google.com/apikey)
//   ANTHROPIC_API_KEY : Claude API 키 (https://console.anthropic.com)
//   OPENAI_API_KEY    : OpenAI 키 (https://platform.openai.com/api-keys) — 있으면 모든 일(사진 읽기·직접 요청·말로 고치기·아바타·받아 적기)에 GPT를 먼저 씀
// 글/사진 읽기 우선순위: OpenAI(GPT, 추론 xhigh) → Claude → Gemini. 앞 것이 실패하면 다음 것으로.
// 기본은 빠른 미니 모델(추론 low), 앱에서 "고급 추론"을 켜면 가장 좋은 모델(추론 xhigh). 사진 읽기는 항상 가장 좋은 모델(high).
// 선택: OPENAI_TEXT_MODEL / OPENAI_FAST_MODEL (없으면 키로 쓸 수 있는 최신 gpt-5 계열·미니 자동 선택), OPENAI_REASONING (고급, 기본 xhigh), OPENAI_FAST_REASONING (기본 low), OPENAI_PHOTO_REASONING (기본 high), OPENAI_VIDEO_REASONING (고급 영상, 기본 xhigh),
//       OPENAI_STT_MODEL (기본 gpt-4o-transcribe), OPENAI_IMAGE_MODEL (기본 gpt-image-1), OPENAI_IMAGE_QUALITY (기본 medium),
//       GEMINI_MODEL (기본 gemini-2.5-flash), CLAUDE_MODEL (기본 claude-sonnet-5-5)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `당신은 셔플댄스 스텝지(종이, 칠판, 화면 캡처, 손글씨, 문서 캡처)를 읽어 "셔플박스 표준 양식" JSON으로 정리하는 도우미입니다.
스텝지는 양식이 제각각입니다(협회 양식, 번호 목록, 글머리표, 가사 옆에 스텝, 빨간 글씨 해설, 화살표, 이모지 등). 어떤 양식이든 아래 규칙으로 옮깁니다.

[가장 중요한 원칙]
1. 사진에 적힌 글은 하나도 빠뜨리지 않습니다. 분류가 애매한 글도 버리지 말고 "text" 줄이나 notes에 넣습니다.
2. 사진의 한 줄(또는 한 글머리표/한 번호)은 lines의 한 항목입니다. 8박 단위로 임의로 나누거나 합치지 않습니다. 한 줄에 스텝이 1개든 5개든 그대로 둡니다.
3. 박수는 사진에 적힌 숫자만 씁니다. 적혀 있지 않으면 "" (빈 문자열)로 두고 절대 지어내지 않습니다. "(4)", "4박", "×4박", "8" 모두 "4"/"8"처럼 숫자만 적습니다.
4. 손동작, 느낌, 감정, 스타일, 의도, 주의 문구(예: "빠이빠이 손동작", "날아갈 듯이", "신나게", "손 X", "회전 주의", "👉 손동작: Seven", "보고 따라 해 보세요")는 삭제하지 말고 가장 가까운 줄의 notes에 넣습니다. 빨간 글씨/괄호 뒤 설명/화살표 뒤 설명이 흔히 이것입니다.
5. 글자가 흐리거나 읽기 애매하면 그 스텝에 "uncertain": true.

[출력 JSON — 이것만 출력, 설명 금지]
{
  "title": "노래 제목(제목/지정곡/안무곡 칸). 없으면 \"\"",
  "artist": "가수. 사진에 없으면 제목으로 아는 가수를 채움, 모르면 \"\"",
  "creator_name": "창작자/응시자 이름 또는 DC/인스타 아이디(예: @love_hera7). 없으면 \"\"",
  "creator_info": "이름 뒤 보조 정보: 기수/지부, DC 아이디, 팀명, 협회·과정명(예: 'DSDA 셔플안무'), 해시태그. 없으면 \"\"",
  "memo": "스텝지 전체에 걸친 규칙·비고(예: '전체 2회 반복', '영상 참고'). 없으면 \"\"",
  "lines": [
    { "kind": "section", "label": "인트로 / A파트" },
    { "kind": "steps", "steps": [ { "name": "런닝맨", "raw": "RM", "beats": "4", "uncertain": false }, { "name": "찰스턴", "beats": "8" } ], "notes": [ { "type": "hand_motion", "text": "손동작: Seven" } ] },
    { "kind": "rest", "label": "4박 쉬기" },
    { "kind": "repeat", "label": "처음부터 한 번 더 반복 (점핑힐까지)" },
    { "kind": "text", "label": "셔플 부분만" }
  ]
}

[줄 종류 kind]
- "steps": 스텝이 적힌 일반 줄. steps 배열에 그 줄의 스텝을 순서대로. 한 줄에 "A / B", "A, B", "A B(4) C(4)"처럼 여러 스텝이 있으면 각각 나눕니다. 방향·변형·카운트 패턴(예: "(오,왼)", "오,왼,오(4) / 왼,오,왼(4)", "(왼→오)", "싱싱더블", "×3", "×2번 + 턴")은 지우지 말고 name 안에 그대로 붙여 둡니다.
- "section": 구간 제목 줄. 예: "[인트로 / A파트]", "(후렴)", "B파트", "전주", "1절". label에 괄호 없이 적습니다.
- "repeat": 반복·구간 지시 줄. 예: "처음부터 한번더 반복 점핑힐까지", "1~3번 반복", "** 반복", "A구간 ×2".
- "rest": 쉼·전환 줄. 예: "-- 4박 쉬기 --", "턴 후 정리", "마무리 포즈".
- "text": 위 어디에도 속하지 않는 글(안내 문장, 제목 아래 설명 등). 예: "셔플 부분만", "나머지 동작은 영상 보고 따라 해 보세요".
- 가사가 스텝 옆에 적힌 양식이면, 각 스텝 줄의 notes에 {"type": "lyric", "text": "가사"}로 가사를 보존합니다. 가사만 있고 스텝이 없는 줄은 "text" 줄로 둡니다.

[notes 종류 type] explanation(해설) / hand_motion(손동작) / style(느낌·스타일: 신나게, 약올리듯) / caution(주의: 손 X, 회전 주의) / creator_intent(창작자 의도) / note(기타) / lyric(가사)

[스텝 이름 표준화] name에는 표준 이름, 원래 표기가 다르면 raw에 원문. 같으면 raw 생략.
RM, 런닝맨, 러닝맨 → 런닝맨 / T스텝, 티스텝, T → 티스텝 / 찰스턴사이드, 사이드찰스턴 → 사이드 찰스턴 / 킥볼, 킥볼체인지 → 그대로 두되 띄어쓰기만 정리 / 영어 약어 W, V, X, Y, RM힐 등은 통용되므로 유지.
표준 이름을 모르면 원문 그대로 name에 적습니다. 과한 추측 금지.

[머리말] "응시자", "창작자", "DC", "지정곡", "제목", "안무곡", "과정" 같은 칸 이름 자체는 값에 넣지 않습니다. "마무리"만 적힌 끝 줄은 넣지 않습니다. 협회 로고/상호는 무시합니다.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // 로그인한 사람만: 앱이 보낸 사용자 토큰을 Auth 서버에 확인한다 (공개 키만으로는 못 씀)
    const auth = req.headers.get("Authorization") ?? "";
    const apikey = req.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    const who: { id?: string } | null = auth.startsWith("Bearer ")
      ? await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, { headers: { apikey, Authorization: auth } }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      : null;
    if (!who?.id) {
      return new Response(JSON.stringify({ error: "로그인이 필요해요" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const body = await req.json() as { images?: { media_type: string; data: string }[]; title?: string; order_request?: string; lines?: string[]; avatar?: { media_type: string; data: string }; edit_request?: string; sheet?: { lines: unknown[]; memo?: string }; audio?: { media_type: string; data: string; hint?: string }; video_sync?: { frames?: { media_type: string; data: string }[]; yt_url?: string; audio?: { media_type: string; data: string }; step?: number; duration?: number; bpm?: number }; yt_frames?: string; deep?: boolean; async?: boolean; sheet_id?: string };
    const keys = detectKeys();
    keys.deep = body.deep === true; // 고급 추론(xhigh) 켰는지. 기본은 빠른 모델
    const { gemini: geminiKey, openai: openaiKey } = keys;

    // 아바타 모드: { avatar: {media_type, data} } — 사진 속 사람을 귀여운 전신 캐릭터로 (OpenAI 키 있으면 GPT 이미지, 없으면 Gemini 이미지 모델)
    // 모델 이름이 바뀌어도 되게: 키로 쓸 수 있는 모델 목록에서 이미지 생성 모델을 찾아 차례로 시도
    if (body.avatar?.data) {
      if (!openaiKey && !geminiKey) throw new Error("AI 아바타는 OpenAI 키나 Gemini 키가 있어야 만들 수 있어요");
      const prompt = "Turn the person in this photo into a cute chibi-style full-body 3D-cartoon dance character (soft Pixar-like sticker look). Big head and small body (about 2.5 heads tall), head near the top of the frame, whole body visible down to the shoes, standing in a playful shuffle-dance pose on a simple floor, facing the camera, smiling. Keep their recognizable features: hair style and color, glasses, face shape, skin tone, age, and the outfit colors from the photo. Plain soft pastel background, portrait 3:4, no text, no watermark.";
      const errors: string[] = [];
      // 1) OpenAI 키가 있으면 GPT 이미지(사진 편집: 얼굴 특징을 유지하는 input_fidelity=high)로 먼저
      if (openaiKey) {
        const bin = Uint8Array.from(atob(body.avatar.data), (c) => c.charCodeAt(0));
        const ext = body.avatar.media_type.includes("png") ? "png" : body.avatar.media_type.includes("webp") ? "webp" : "jpg";
        const forced = Deno.env.get("OPENAI_IMAGE_MODEL")?.trim();
        const models = [...(forced ? [forced] : []), "gpt-image-1", "gpt-image-1-mini"].filter((m, i, a) => a.indexOf(m) === i);
        const quality = Deno.env.get("OPENAI_IMAGE_QUALITY")?.trim() || "medium";
        for (const model of models) {
          for (const fidelity of [true, false]) {
            const form = new FormData();
            form.append("model", model);
            form.append("image", new Blob([bin], { type: body.avatar.media_type }), `photo.${ext}`);
            form.append("prompt", prompt);
            form.append("size", "1024x1536");
            form.append("quality", quality);
            form.append("n", "1");
            if (fidelity) form.append("input_fidelity", "high");
            const res = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${openaiKey}` }, body: form });
            const j = await res.json().catch(() => ({}));
            if (!res.ok) {
              const msg = j?.error?.message ?? `HTTP ${res.status}`;
              console.error(`[avatar] openai ${model}${fidelity ? "" : " (no input_fidelity)"}: ${res.status} ${msg}`);
              errors.push(`${model}: ${msg}`);
              // input_fidelity를 모르는 모델이면 빼고 한 번 더, 그 밖(모델 없음·조직 인증·한도)은 다음 모델로
              if (fidelity && res.status === 400 && /input_fidelity/i.test(msg)) continue;
              break;
            }
            const b64 = j?.data?.[0]?.b64_json;
            if (b64) {
              console.log(`[avatar] ok via openai ${model}`);
              return new Response(JSON.stringify({ image: b64, media_type: "image/png", model }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            console.error(`[avatar] openai ${model}: no image`);
            errors.push(`${model}: 그림 없음`);
            break;
          }
        }
        if (!geminiKey) throw new Error(`아바타를 만들지 못했어요. ${errors[0] ?? ""}`.trim());
        console.log("[avatar] openai failed, trying gemini");
      }
      // 2) Gemini 이미지 모델 (OpenAI 키가 없거나 실패했을 때)
      const candidates = await imageModels(geminiKey!);
      if (!candidates.length) throw new Error("이 Gemini 키로 쓸 수 있는 이미지 생성 모델이 없어요 (AI Studio에서 결제/한도를 확인해 주세요)");
      for (const model of candidates) {
        for (const withCfg of [true, false]) {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey! },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ inline_data: { mime_type: body.avatar.media_type, data: body.avatar.data } }, { text: prompt }] }],
              generationConfig: withCfg ? { responseModalities: ["IMAGE", "TEXT"], imageConfig: { aspectRatio: "3:4" } } : { responseModalities: ["IMAGE", "TEXT"] },
            }),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) {
            const msg = j?.error?.message ?? `HTTP ${res.status}`;
            console.error(`[avatar] ${model}${withCfg ? "" : " (no imageConfig)"}: ${res.status} ${msg}`);
            errors.push(`${model}: ${msg}`);
            // 설정 필드를 모르는 모델이면 설정 없이 한 번 더, 그 밖의 오류(모델 없음·한도·결제)는 다음 모델로
            if (withCfg && res.status === 400 && /imageConfig|aspect/i.test(msg)) continue;
            break;
          }
          type Part = { inlineData?: { mimeType?: string; data: string }; inline_data?: { mime_type?: string; data: string }; text?: string };
          const parts: Part[] = j.candidates?.[0]?.content?.parts ?? [];
          const img = parts.map((p) => p.inlineData ?? p.inline_data).find((x) => x?.data);
          if (img) {
            console.log(`[avatar] ok via ${model}`);
            return new Response(JSON.stringify({ image: img.data, media_type: (img as { mimeType?: string }).mimeType ?? (img as { mime_type?: string }).mime_type ?? "image/png", model }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          const why = j.candidates?.[0]?.finishReason ?? j.promptFeedback?.blockReason ?? parts.map((p) => p.text).filter(Boolean).join(" ").slice(0, 120);
          console.error(`[avatar] ${model}: no image (${why})`);
          errors.push(`${model}: 그림 없음 (${why})`);
          break;
        }
      }
      throw new Error(`아바타를 만들지 못했어요. ${errors[0] ?? ""}`.trim());
    }

    // 받아 적기 모드: { audio: {media_type, data(base64), hint?} } — 녹음한 말을 글로. OpenAI 키가 있으면 Whisper 계열, 없으면 Gemini
    if (body.audio?.data) {
      const hint = body.audio.hint ?? "셔플댄스 스텝지 앱에서 말한 요청. 스텝 이름(런닝맨, 티스텝, 찰스턴, 크리스크로스, 글라이드, 킥볼체인지, 스핀), 박수(2박, 4박, 8박, 16박 — 숫자로 적기), 줄 번호(1번, 2번), 초, BPM이 자주 나옴.";
      if (openaiKey) {
        const bin = Uint8Array.from(atob(body.audio.data), (c) => c.charCodeAt(0));
        const ext = body.audio.media_type.includes("mp4") ? "mp4" : body.audio.media_type.includes("ogg") ? "ogg" : body.audio.media_type.includes("wav") ? "wav" : "webm";
        const form = new FormData();
        form.append("file", new Blob([bin], { type: body.audio.media_type }), `speech.${ext}`);
        form.append("model", Deno.env.get("OPENAI_STT_MODEL") ?? "gpt-4o-transcribe");
        form.append("language", "ko");
        form.append("prompt", hint);
        form.append("response_format", "json");
        const res = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${openaiKey}` }, body: form });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          console.error(`[stt] openai ${res.status} ${j?.error?.message ?? ""}`);
          throw new Error(j?.error?.message ?? `OpenAI 오류 ${res.status}`);
        }
        return new Response(JSON.stringify({ text: String(j.text ?? "").trim(), engine: "openai" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!geminiKey) throw new Error("받아 적기에는 OpenAI 키나 Gemini 키가 필요해요");
      const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ inline_data: { mime_type: body.audio.media_type, data: body.audio.data } }, { text: `이 녹음을 한국어로 정확히 받아 적어 주세요. 맥락: ${hint}\n말한 내용만 그대로 적고, 설명이나 따옴표 없이 글만 출력하세요. 아무 말도 없으면 빈 문자열.` }] }],
          generationConfig: { temperature: 0 },
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error(`[stt] gemini ${res.status} ${j?.error?.message ?? ""}`);
        throw new Error(j?.error?.message ?? `Gemini 오류 ${res.status}`);
      }
      const text = ((j.candidates?.[0]?.content?.parts ?? []) as { text?: string }[]).map((p) => p.text ?? "").join("").trim();
      return new Response(JSON.stringify({ text, engine: "gemini" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 스텝 내용 고치기 모드: { edit_request, sheet: { lines, memo } } — 말로 한 요청대로 줄 내용을 직접 바꿔 전체 lines를 돌려줌
    if (body.edit_request && body.sheet && Array.isArray(body.sheet.lines)) {
      const sys = `당신은 셔플댄스 스텝지 편집 도우미입니다. 스텝지 JSON과 사용자의 요청(말로 한 것을 받아 적은 글이라 띄어쓰기·조사가 어색할 수 있음)을 읽고, 요청대로 고친 스텝지 전체를 같은 JSON 구조로 돌려줍니다.

[스텝지 구조] lines 배열. 각 줄:
- {"kind":"steps","steps":[{"name":"런닝맨","beats":"4"},{"name":"티스텝","beats":"4"}],"notes":[{"text":"양손 빠이빠이","type":"hand_motion"}]}  : 스텝 줄. beats는 숫자 문자열("4","8") 또는 "". notes는 선택(type: explanation|hand_motion|style|caution|creator_intent|note|lyric)
- {"kind":"section","steps":[],"label":"후렴"}  : 구간 제목 줄
- {"kind":"repeat","steps":[],"label":"처음부터 한 번 더"}  : 반복 지시 줄
- {"kind":"rest","steps":[],"label":"4박 쉬기"}  : 쉼·전환 줄
- {"kind":"text","steps":[],"label":"..."}  : 그 밖의 글
"N번 줄"은 스텝 줄만 1부터 센 번호입니다(구간 줄이 나오면 다시 1부터). 요청의 "N번"은 이 번호를 뜻합니다. 사용자가 줄을 "후렴 첫 줄"처럼 구간으로 가리킬 수도 있습니다.

[규칙]
- 요청에 언급된 것만 바꾸고 나머지는 글자 하나 바꾸지 않고 그대로 둡니다(raw, uncertain 같은 다른 필드도 그대로).
- 스텝 이름은 스텝지에서 이미 쓰는 표기를 따르고, 박수를 말하면 beats에 숫자만 적습니다("4박" → "4", "여덟 박"·"8카운트" → "8"). 말한 숫자를 그대로 쓰고, 스텝 개수나 마디 수로 바꿔 계산하지 않습니다. 박수를 말하지 않은 스텝의 beats는 그대로 둡니다.
- "지워", "빼" → 그 줄이나 스텝을 삭제. "추가", "넣어", "아래에" → 그 자리에 새 줄/스텝. "바꿔", "대신" → 교체. "해설", "메모", "손동작" → notes에 추가/수정.
- 요청이 가리키는 줄을 찾을 수 없거나 뜻을 알 수 없으면 lines를 원본 그대로 두고 unclear에 짧게 되묻는 말(한국어)을 적습니다. 그 밖에는 unclear를 빈 문자열로.
반드시 JSON {"lines":[...], "note":"바뀐 점 한 줄(한국어, 25자 내)", "unclear":""} 만 출력합니다.`;
      const ask = `[스텝지]\n${JSON.stringify({ lines: body.sheet.lines, memo: body.sheet.memo ?? "" })}\n\n[요청]\n${String(body.edit_request).trim()}`;
      const t = await askAI([], ask, sys, keys, "edit");
      const s0 = t.indexOf("{"); const e0 = t.lastIndexOf("}");
      const j = s0 >= 0 ? JSON.parse(t.slice(s0, e0 + 1)) : {};
      return new Response(JSON.stringify({ lines: Array.isArray(j.lines) ? j.lines : null, note: j.note ?? "", unclear: j.unclear ?? "" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 유튜브 미리보기 장면 모드: { yt_frames: videoId } — 유튜브가 탐색 바 미리보기용으로 공개해 둔 스토리보드(스프라이트 격자)를 가져다 줌
    if (body.yt_frames) {
      const vid = String(body.yt_frames).trim();
      if (!/^[\w-]{11}$/.test(vid)) throw new Error("유튜브 영상 ID가 이상해요");
      const sb = await ytStoryboard(vid);
      return new Response(JSON.stringify(sb), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 영상 보고 맞추기 모드(고도 추론): { video_sync: { frames(장면표 그림들), step, duration, bpm }, lines } — AI가 장면표를 보고 줄마다 시작 시각을 찾아 계획으로
    if ((body.video_sync?.frames?.length || body.video_sync?.yt_url || body.video_sync?.audio?.data) && body.lines?.length) {
      const vs = body.video_sync;
      const frames = (vs.frames ?? []).slice(0, 24);
      const ytUrl = vs.yt_url?.trim();
      const audioIn = !ytUrl && !frames.length && vs.audio?.data ? vs.audio : null; // 음악 파일만 있을 때: Gemini가 듣고 맞춤
      if (audioIn && !keys.gemini) throw new Error("음악을 AI가 직접 들으려면 Gemini 키가 필요해요 (aistudio.google.com/apikey 에서 무료로 받아 Supabase Secrets에 넣어 주세요)");
      const bpm = typeof vs.bpm === "number" && vs.bpm > 0 ? vs.bpm : null;
      const beat = bpm ? 60 / bpm : null;
      if (ytUrl && !keys.gemini) throw new Error("유튜브 영상을 AI가 직접 보려면 Gemini 키가 필요해요 (aistudio.google.com/apikey 에서 무료로 받아 Supabase Secrets에 넣어 주세요)");
      const sys = `당신은 셔플댄스 영상을 보고 스텝지의 각 줄이 영상에서 언제 시작되는지 찾아 주는 전문가입니다. 셔플댄스의 기본 스텝(런닝맨: 제자리에서 무릎을 들며 뒤로 미끄러지듯 달리는 동작, 티스텝: 옆으로 발뒤꿈치·발끝을 비틀며 이동, 찰스턴: 앞뒤로 차며 몸을 비트는 동작, 크리스크로스: 두 발을 교차하는 점프, 킥: 발 차기, 스핀/턴: 회전, 글라이드: 미끄러지듯 이동, 킥볼체인지)을 화면에서 알아볼 수 있습니다.

[입력]
- 장면표 그림 여러 장: 영상에서 일정 간격으로 뽑은 프레임을 시간순(왼쪽→오른쪽, 위→아래)으로 붙인 것. 각 칸 왼쪽 위 노란 글씨가 그 장면의 시각(초)입니다.
- 스텝 줄 목록: 번호는 1부터, 괄호 안은 그 줄의 박수. 한 줄은 그 박수만큼 이어집니다.
- 박자(BPM)가 주어지면 한 박 = 60/BPM 초이고, 줄의 길이 = 박수 × 한 박입니다.

[할 일]
1. 영상에서 춤이 실제로 시작되는 순간(전주 동안 서 있거나 준비 자세인 구간은 쉼)을 찾습니다.
2. 스텝지 순서대로 각 줄의 동작이 시작되는 시각을 찾습니다. 줄이 반복되면(후렴 두 번 등) 같은 줄 번호를 여러 번 적고, 건너뛰면 뺍니다. 줄 사이에 멈춤·전환이 있으면 그만큼 시간이 비어도 됩니다.
3. 춤은 박자에 맞춰 추므로, 첫 줄 시작 시각을 기준으로 다음 줄들은 보통 "앞 줄 시작 + 앞 줄 박수 × 한 박"에 시작합니다. 장면표에서 동작이 바뀌는 지점으로 이를 확인·보정하세요. 장면 간격이 ${vs.step}초라 시각은 그 절반 정도 오차가 있을 수 있으니, 박자 격자에 맞게 다듬어 소수 첫째 자리까지 적습니다.
4. 스텝 줄의 박수는 목록에 적힌 그대로입니다. 바꾸지 않습니다.

[출력] 반드시 JSON만:
{"plan":[{"line":1,"at":12.3},{"line":2,"at":16.1}, ...], "start_at": 첫 줄 시작 초, "bpm": 영상으로 짐작한 BPM 또는 null, "confidence":"high|medium|low", "note":"한 줄 요약(한국어, 30자 내)", "unclear":""}
- plan은 춤추는 순서대로, 모든 항목에 at(초)을 넣습니다.
- 영상이 이 스텝지의 춤이 아니거나 사람이 안 보이면 plan을 빈 배열로 두고 unclear에 이유를 한국어로 짧게 적습니다.`;
      const ask = audioIn
        ? `[스텝 줄 목록]\n${body.lines.map((l) => String(l)).join("\n")}\n\n[음악 정보]\n첨부한 음악 파일 전체(소리만, 춤은 안 보임).${bpm ? ` 박자 ${bpm} BPM → 한 박 ${beat!.toFixed(3)}초, 4박 ${(beat! * 4).toFixed(2)}초, 8박 ${(beat! * 8).toFixed(2)}초.` : " 박자는 아직 모릅니다(음악에서 재서 bpm에 적어 주세요)."}\n\n음악을 처음부터 끝까지 듣고 전주가 끝나고 춤(1번 줄)이 시작될 만한 순간, 그리고 구절(8박 단위)이 바뀌는 순간들을 박자 격자에 맞춰 찾아 각 줄의 시작 시각을 초 단위로 JSON으로 답해 주세요. 스텝지의 줄 순서와 박수를 그대로 따르고, 음악의 절·후렴 구조와 길이가 맞도록 쉼이나 반복을 넣으세요.`
        : ytUrl
        ? `[스텝 줄 목록]\n${body.lines.map((l) => String(l)).join("\n")}\n\n[영상 정보]\n첨부한 유튜브 영상 전체(소리 포함).${bpm ? ` 박자 ${bpm} BPM → 한 박 ${beat!.toFixed(3)}초, 4박 ${(beat! * 4).toFixed(2)}초, 8박 ${(beat! * 8).toFixed(2)}초.` : " 박자는 아직 모릅니다(음악에서 짐작해 bpm에 적어 주세요)."}\n\n영상을 처음부터 끝까지 보고(음악의 박자와 춤 동작을 함께 보고) 각 줄의 시작 시각을 초 단위로 찾아 JSON으로 답해 주세요.`
        : `[스텝 줄 목록]\n${body.lines.map((l) => String(l)).join("\n")}\n\n[영상 정보]\n길이 ${vs.duration}초, ${vs.step}초마다 한 장면, 장면표 ${frames.length}장(시간순).${bpm ? ` 박자 ${bpm} BPM → 한 박 ${beat!.toFixed(3)}초, 4박 ${(beat! * 4).toFixed(2)}초, 8박 ${(beat! * 8).toFixed(2)}초.` : " 박자는 아직 모릅니다."}\n\n장면표를 보고 각 줄의 시작 시각을 찾아 주세요.`;
      const run = async () => {
        const inputSec = "[입력]\n- 장면표 그림 여러 장: 영상에서 일정 간격으로 뽑은 프레임을 시간순(왼쪽→오른쪽, 위→아래)으로 붙인 것. 각 칸 왼쪽 위 노란 글씨가 그 장면의 시각(초)입니다.";
        const t = audioIn
          ? await viaGeminiMedia({ inline_data: { mime_type: audioIn.media_type || "audio/mpeg", data: audioIn.data } }, keys.gemini!, ask, sys.replace(inputSec, "[입력]\n- 음악 파일 자체(소리만). 시각은 음악의 실제 재생 시각(초)입니다. 춤은 보이지 않으므로 음악의 구조(전주·절·후렴·브릿지)와 박자, 8박 구절 경계로 줄 시작을 추정합니다."), keys.deep === true, "audio")
          : ytUrl
          ? await viaGeminiMedia({ file_data: { file_uri: ytUrl } }, keys.gemini!, ask, sys.replace(inputSec, "[입력]\n- 유튜브 영상 자체(그림과 소리). 시각은 영상의 실제 재생 시각(초)입니다."), keys.deep === true, "video")
          : await askAI(frames, ask, sys, keys, "video");
        const s0 = t.indexOf("{"); const e0 = t.lastIndexOf("}");
        const j = s0 >= 0 ? JSON.parse(t.slice(s0, e0 + 1)) : {};
        const plan = Array.isArray(j.plan) ? j.plan : [];
        const order = plan.filter((p: { line?: number }) => typeof p?.line === "number").map((p: { line: number }) => p.line);
        console.log(`[video] plan ${plan.length} items, confidence=${j.confidence ?? "?"}, note=${j.note ?? ""}`);
        return { plan, order, start_at: j.start_at ?? null, bpm: j.bpm ?? null, note: j.note ? `${j.note}${j.confidence && j.confidence !== "high" ? ` (확신 ${j.confidence === "low" ? "낮음" : "보통"})` : ""}` : "", unclear: j.unclear ?? "" };
      };
      // 오래 걸리는 일: 앱이 화면을 떠나거나 꺼져도 서버에서 이어서 돌리고 결과를 ai_jobs에 남김 (앱은 작업 번호로 확인)
      if (body.async) {
        const job = await jobs.create(who.id, body.sheet_id ?? null, "video_sync");
        if (job) {
          EdgeRuntime.waitUntil(
            run()
              .then((r) => jobs.finish(job, r))
              .catch((e) => jobs.fail(job, (e as Error).message)),
          );
          return new Response(JSON.stringify({ job_id: job }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
      return new Response(JSON.stringify(await run()), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 직접 요청 모드: { order_request, lines } — 비정형 요청을 춤추는 계획(줄 순서·쉼·길이·시작 시각·박자)으로
    if (body.order_request && body.lines?.length) {
      const sys = `당신은 셔플댄스 스텝지와 실제 영상/노래의 타이밍을 맞춰 주는 도우미입니다. 스텝 줄 목록(번호는 1부터, 괄호 안은 그 줄의 박수)과 사용자의 요청(말로 한 것을 받아 적은 글이라 띄어쓰기·조사가 어색할 수 있음)을 읽고, 영상/노래에서 실제로 춤추는 차례를 plan 배열로 적습니다.

plan 항목 종류:
- {"line": N} : N번 줄을 춤 (한 줄 = 그 줄의 박수만큼 시간이 흐름)
- {"line": N, "beats": B} : 사용자가 그 줄의 길이를 직접 말했을 때만 (예: "3번은 16박으로 길게" → 16, "2번은 반만" → 그 줄 박수의 절반). 말하지 않은 줄에는 beats를 절대 넣지 않습니다. 줄의 박수는 목록의 괄호 숫자이며 임의로 줄이거나 늘리지 않습니다(찰스턴 4 = 4박, 두 스텝 4+4 = 8박).
- {"line": N, "at": 초} : 요청에 그 줄의 시작 시각이 있을 때 (예: "2번은 35초에", "후렴은 1분 10초부터")
- {"rest": 박수} : 그만큼 쉼. 동작 없음, 전환, 기다림, 전주 (예: "1번 하고 4박 더 쉬고 2번" → line 1, rest 4, line 2 / "2번 전에 8박 기다렸다가" → rest 8, line 2 / "한 마디 쉬고" → rest 4, "두 마디" → rest 8)

규칙:
- 반복이면 같은 line을 여러 번 적습니다("후렴 두 번", "1번 한 번 더").
- 요청에 언급되지 않은 줄은 원래 순서와 길이를 그대로 둡니다. 전체 계획을 처음부터 끝까지 빠짐없이 적습니다.
- "안 춤", "빼고", "생략"은 그 줄을 뺍니다. "N번부터 시작"은 N번 앞 줄들을 빼되, "맨 끝에"처럼 위치를 말하면 거기에 넣습니다.
- 구간 이름(후렴, 인트로, A파트 등)은 줄 앞의 [구간] 표시로 찾습니다. 구간을 말하면 그 구간의 줄 전부를 뜻합니다.
- 전체 시작 시각을 말하면(예: "12초부터", "0:35에 첫 줄") start_at에 초 단위 숫자로, 박자를 말하면(예: "박자 120", "BPM 132", "좀 더 빠르게 130") bpm에 숫자로 적습니다. 없으면 null.
- 요청이 스텝지에 없는 줄·구간을 가리키거나 뜻을 알 수 없으면 plan을 빈 배열로 두고 unclear에 짧게 되묻는 말(한국어)을 적습니다. 그 밖에는 unclear를 빈 문자열로.

반드시 JSON {"plan": [...], "start_at": 초 또는 null, "bpm": 숫자 또는 null, "note": "바뀐 점 한 줄(한국어, 20자 내)", "unclear": ""} 만 출력합니다.`;
      const ask = `[스텝 줄 목록]\n${body.lines.map((l) => String(l)).join("\n")}\n\n[요청]\n${String(body.order_request).trim()}`;
      const t = await askAI([], ask, sys, keys, "plan");
      const s0 = t.indexOf("{"); const e0 = t.lastIndexOf("}");
      const j = s0 >= 0 ? JSON.parse(t.slice(s0, e0 + 1)) : {};
      const plan = Array.isArray(j.plan) ? j.plan : [];
      // 옛 앱 호환: order(줄 번호 목록)도 같이
      const order = plan.filter((p: { line?: number }) => typeof p?.line === "number").map((p: { line: number }) => p.line);
      return new Response(JSON.stringify({ plan, order, start_at: j.start_at ?? null, bpm: j.bpm ?? null, note: j.note ?? "", unclear: j.unclear ?? "" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 가수 추정 모드: { title } 만 오면 노래 제목으로 가수를 알려 줌
    if (body.title && !body.images?.length) {
      const q = `노래 제목: "${body.title.trim()}"\n이 노래의 가수(원곡 가수) 이름만 한국어로 답하세요. 모르거나 애매하면 빈 문자열. 반드시 JSON {"artist": "..."} 만 출력.`;
      const t = await askAI([], q, SYSTEM, keys, "artist");
      const s0 = t.indexOf("{"); const e0 = t.lastIndexOf("}");
      const artist = s0 >= 0 ? String(JSON.parse(t.slice(s0, e0 + 1)).artist ?? "") : "";
      return new Response(JSON.stringify({ artist }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const images = body.images ?? [];
    if (!images.length) throw new Error("이미지가 없습니다");
    const text = await askAI(images, ASK, SYSTEM, keys, "photo");

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const json = JSON.parse(text.slice(start, end + 1));

    return new Response(JSON.stringify(json), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

type Img = { media_type: string; data: string };

/** 이 키로 쓸 수 있는 이미지 생성 모델(이름에 image, generateContent 지원)을 선호 순서로. 환경변수 GEMINI_IMAGE_MODEL이 있으면 맨 앞 */
async function imageModels(key: string): Promise<string[]> {
  const prefer = ["gemini-3.1-flash-lite-image", "gemini-3.1-flash-image", "gemini-3-pro-image-preview", "gemini-2.5-flash-image", "gemini-2.5-flash-image-preview"];
  const forced = Deno.env.get("GEMINI_IMAGE_MODEL")?.trim();
  let avail: string[] = [];
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": key } });
    const j = await res.json();
    avail = ((j.models ?? []) as { name: string; supportedGenerationMethods?: string[] }[])
      .filter((m) => /image/i.test(m.name) && (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""));
    console.log(`[avatar] image models: ${avail.join(", ") || "(none)"}`);
  } catch (e) {
    console.error(`[avatar] models list failed: ${(e as Error).message}`);
  }
  const ordered = [...prefer.filter((p) => avail.includes(p)), ...avail.filter((a) => !prefer.includes(a) && !/veo|embedding|tts|live|audio/i.test(a))];
  if (!ordered.length) ordered.push(...prefer); // 목록을 못 받았으면 알려진 이름으로 그냥 시도
  return forced ? [forced, ...ordered.filter((m) => m !== forced)] : ordered;
}


// 비밀키 이름을 조금 다르게 적어도(예: "antrophic key", "셔플") 찾도록: 이름으로 먼저, 안 되면 값 모양으로
//   OpenAI: sk-… (sk-ant- 제외) / Claude: sk-ant-… / Gemini: AIza…
function detectKeys(): Keys {
  const env = Object.entries(Deno.env.toObject())
    .filter(([k, v]) => !/^(SUPABASE_|SB_|DENO_)/.test(k) && v.trim())
    .map(([k, v]) => [k, v.trim()] as const);
  // 값 모양이 확실하면 그걸 믿고, 모양을 모르는 값만 이름으로 판단 (이름을 잘못 붙여도 됨)
  const byValue = (re: RegExp) => env.find(([, v]) => re.test(v))?.[1];
  const unknownShape = ([, v]: readonly [string, string]) => !/^(sk-|AIza)/.test(v);
  const byName = (re: RegExp) => env.filter(unknownShape).find(([k]) => re.test(k))?.[1];
  const claude = byValue(/^sk-ant-/) ?? byName(/ant.?h?rop|claude/i);
  const openai = byValue(/^sk-(?!ant-)/) ?? byName(/openai|gpt/i);
  const gemini = byValue(/^AIza/) ?? byName(/gemini|google/i);
  const tag = (v?: string) => (v ? `${v.slice(0, 6)}…(${v.length})` : "-");
  console.log(`[keys] openai=${tag(openai)} claude=${tag(claude)} gemini=${tag(gemini)}`);
  return { openai, claude, gemini };
}
const ASK = "이 스텝지를 위 양식의 JSON으로 정리해 주세요.";

/**
 * 유튜브 스토리보드: 영상 페이지의 playerStoryboardSpecRenderer.spec 을 읽어 스프라이트 그림(JPEG)들을 가져온다.
 * spec = "기본URL|w#h#frames#cols#rows#_#이름#sigh|..." (레벨마다 한 덩어리). 320×180 레벨을 우선, 없으면 가장 큰 것
 */
async function ytStoryboard(vid: string) {
  const got = await ytSpec(vid);
  if (!got) throw new Error("유튜브에서 미리보기 장면을 가져오지 못했어요 (비공개·연령 제한 영상이거나 유튜브가 서버 요청을 막았어요). 잠시 뒤 다시 해 보세요");
  const { spec, duration } = got;
  const [base, ...levels] = spec.split("|");
  type Lv = { i: number; w: number; h: number; frames: number; cols: number; rows: number; name: string; sigh: string };
  const parsed: Lv[] = levels
    .map((l, i) => {
      const a = l.split("#");
      if (a.length !== 8) return null;
      return { i, w: +a[0], h: +a[1], frames: +a[2], cols: +a[3], rows: +a[4], name: a[6], sigh: a[7] };
    })
    .filter((x): x is Lv => !!x && x.frames > 1 && x.cols > 0 && x.rows > 0);
  if (!parsed.length) throw new Error("유튜브 미리보기 장면 정보를 읽지 못했어요");
  const usable = parsed.filter((l) => l.frames >= 20);
  const pick = usable.find((l) => l.w === 320) ?? [...usable].sort((a, b) => b.w - a.w)[0] ?? parsed[parsed.length - 1];
  const nImg = Math.ceil(pick.frames / (pick.cols * pick.rows));
  const urls = Array.from({ length: Math.min(nImg, 40) }, (_, j) => `${base.replace("$L", String(pick.i)).replace("$N", pick.name.replace("$M", String(j)))}&sigh=${pick.sigh}`);
  console.log(`[yt] ${vid}: ${duration}s, level ${pick.i} ${pick.w}x${pick.h} frames=${pick.frames} grid=${pick.cols}x${pick.rows} images=${urls.length}`);
  const images = await Promise.all(urls.map(async (u) => {
    try {
      const r = await fetch(u);
      if (!r.ok) {
        console.error(`[yt] sprite ${r.status}: ${u.slice(0, 80)}`);
        return "";
      }
      return b64(new Uint8Array(await r.arrayBuffer()));
    } catch (e) {
      console.error(`[yt] sprite failed: ${(e as Error).message}`);
      return "";
    }
  }));
  if (!images.some(Boolean)) throw new Error("유튜브 미리보기 그림을 받지 못했어요");
  return { images, cols: pick.cols, rows: pick.rows, w: pick.w, h: pick.h, total: Math.min(pick.frames, urls.length * pick.cols * pick.rows), interval: duration / pick.frames, duration };
}
/**
 * 스토리보드 spec과 길이 얻기. 1) 웹 플레이어가 쓰는 공개 JSON API(youtubei/v1/player, WEB·WEB_EMBEDDED 클라이언트)
 * 2) 영상 페이지 HTML. 서버 IP에 따라 어느 쪽은 429/봇 확인이 뜨므로 차례로 시도
 */
async function ytSpec(vid: string): Promise<{ spec: string; duration: number } | null> {
  const clients = [
    { clientName: "WEB", clientVersion: "2.20250101.00.00" },
    { clientName: "WEB_EMBEDDED_PLAYER", clientVersion: "1.20250101.00.00" },
  ];
  for (const client of clients) {
    try {
      const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": "ko,en;q=0.8" },
        body: JSON.stringify({ context: { client: { ...client, hl: "ko", gl: "KR" } }, videoId: vid, contentCheckOk: true, racyCheckOk: true }),
      });
      const j = await res.json().catch(() => ({}));
      const spec = j?.storyboards?.playerStoryboardSpecRenderer?.spec;
      const duration = Number(j?.videoDetails?.lengthSeconds);
      const status = j?.playabilityStatus?.status;
      if (typeof spec === "string" && duration > 0) {
        console.log(`[yt] spec via player api (${client.clientName})`);
        return { spec, duration };
      }
      console.error(`[yt] player api ${client.clientName}: http ${res.status}, playability ${status ?? "?"} ${j?.playabilityStatus?.reason ?? ""}, spec ${spec ? "yes" : "no"}`);
    } catch (e) {
      console.error(`[yt] player api ${client.clientName} failed: ${(e as Error).message}`);
    }
  }
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${vid}&hl=ko`, { headers: { "Accept-Language": "ko,en;q=0.8" } });
    const html = await res.text();
    const m = html.match(/"playerStoryboardSpecRenderer":\{"spec":"((?:[^"\\]|\\.)*)"/);
    const lenM = html.match(/"lengthSeconds":"(\d+)"/);
    if (m && lenM) {
      console.log("[yt] spec via watch page");
      return { spec: JSON.parse(`"${m[1]}"`), duration: Number(lenM[1]) };
    }
    console.error(`[yt] watch page: status ${res.status}, len ${html.length}, ${/consent/i.test(res.url) ? "consent page" : "no spec"}`);
  } catch (e) {
    console.error(`[yt] watch page failed: ${(e as Error).message}`);
  }
  return null;
}
function b64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

/** ai_jobs 표 읽고 쓰기 (서비스 키로). 표가 없거나 키가 없으면 null을 돌려 동기 방식으로 처리 */
const jobs = {
  headers() {
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS")?.split(",")[0]?.trim() ?? "";
    return key ? { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" } : null;
  },
  async create(userId: string, sheetId: string | null, kind: string): Promise<string | null> {
    const h = this.headers();
    if (!h) return null;
    try {
      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/ai_jobs`, { method: "POST", headers: { ...h, Prefer: "return=representation" }, body: JSON.stringify({ created_by: userId, sheet_id: sheetId, kind }) });
      const j = await res.json();
      if (!res.ok) {
        console.error(`[jobs] create ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
        return null;
      }
      return j?.[0]?.id ?? null;
    } catch (e) {
      console.error(`[jobs] create failed: ${(e as Error).message}`);
      return null;
    }
  },
  async update(id: string, patch: Record<string, unknown>) {
    const h = this.headers();
    if (!h) return;
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/ai_jobs?id=eq.${id}`, { method: "PATCH", headers: h, body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }) });
    if (!res.ok) console.error(`[jobs] update ${res.status}: ${(await res.text()).slice(0, 200)}`);
  },
  finish(id: string, result: unknown) {
    console.log(`[jobs] ${id} done`);
    return this.update(id, { status: "done", result });
  },
  fail(id: string, error: string) {
    console.error(`[jobs] ${id} failed: ${error}`);
    return this.update(id, { status: "failed", error });
  },
};

type Keys = { openai?: string; claude?: string; gemini?: string; deep?: boolean };
type Task = "photo" | "plan" | "edit" | "artist" | "video";

/** 키가 있는 모델을 OpenAI → Claude → Gemini 순으로 시도. 앞 것이 실패하면(모델 없음·한도·시간 초과) 다음 것으로 */
async function askAI(images: Img[], ask: string, sys: string, keys: Keys, task: Task): Promise<string> {
  const tries: { name: string; run: () => Promise<string> }[] = [];
  if (keys.openai) tries.push({ name: "openai", run: () => viaOpenAI(images, keys.openai!, ask, sys, task, keys.deep === true) });
  if (keys.claude) tries.push({ name: "claude", run: () => viaClaude(images, keys.claude!, ask, sys) });
  if (keys.gemini) tries.push({ name: "gemini", run: () => viaGemini(images, keys.gemini!, ask, sys) });
  if (!tries.length) throw new Error("AI 키가 설정되지 않았습니다 (OPENAI_API_KEY, ANTHROPIC_API_KEY 또는 GEMINI_API_KEY)");
  let lastErr: Error | null = null;
  for (const t of tries) {
    try {
      const out = await t.run();
      if (out.includes("{")) {
        console.log(`[${task}] ok via ${t.name}`);
        return out;
      }
      lastErr = new Error(`${t.name}: 빈 답`);
    } catch (e) {
      lastErr = e as Error;
      console.error(`[${task}] ${t.name} failed: ${lastErr.message}`);
    }
  }
  throw lastErr ?? new Error("AI 호출 실패");
}

let openaiModelCache: { key: string; best: string; fast: string } | null = null;
/**
 * 쓸 수 있는 gpt-5 계열 모델: best(가장 좋은 것, 고급 추론·사진 읽기용)와 fast(미니 계열, 기본용).
 * OPENAI_TEXT_MODEL / OPENAI_FAST_MODEL 환경변수가 있으면 그것
 */
async function openaiModels(key: string): Promise<{ best: string; fast: string }> {
  if (openaiModelCache?.key === key) return openaiModelCache;
  const preferBest = ["gpt-5.5", "gpt-5.4", "gpt-5.3", "gpt-5.2", "gpt-5.1", "gpt-5"];
  const preferFast = ["gpt-5.5-mini", "gpt-5.4-mini", "gpt-5.3-mini", "gpt-5.2-mini", "gpt-5.1-mini", "gpt-5-mini"];
  let best = "gpt-5";
  let fast = "";
  try {
    const res = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } });
    const j = await res.json();
    const ids = new Set(((j.data ?? []) as { id: string }[]).map((m) => m.id));
    best = preferBest.find((m) => ids.has(m)) ?? best;
    fast = preferFast.find((m) => ids.has(m)) ?? "";
    console.log(`[openai] models: best=${best} fast=${fast || "(none, use best with low effort)"}`);
  } catch (e) {
    console.error(`[openai] models list failed: ${(e as Error).message}`);
  }
  const out = { key, best: Deno.env.get("OPENAI_TEXT_MODEL")?.trim() || best, fast: Deno.env.get("OPENAI_FAST_MODEL")?.trim() || fast || best };
  openaiModelCache = out;
  return out;
}

/**
 * OpenAI Responses API.
 * 기본(빠름): 미니 모델 + 추론 low. 고급(deep): 가장 좋은 모델 + xhigh(영상도 xhigh). 사진 읽기는 항상 가장 좋은 모델 + high.
 * 모델이 모르는 추론 세기면 한 단계씩 낮춰 재시도
 */
async function viaOpenAI(images: Img[], key: string, ask: string, sys: string, task: Task, deep: boolean): Promise<string> {
  const models = await openaiModels(key);
  const strong = deep || task === "photo";
  const model = strong ? models.best : models.fast;
  const envWant = (task === "photo" ? Deno.env.get("OPENAI_PHOTO_REASONING") : task === "video" ? Deno.env.get("OPENAI_VIDEO_REASONING") : Deno.env.get("OPENAI_REASONING"))?.trim();
  const want = task === "photo" ? envWant || "high" : deep ? envWant || "xhigh" : Deno.env.get("OPENAI_FAST_REASONING")?.trim() || "low";
  const ladder = ["xhigh", "high", "medium", "low"];
  const efforts = [want, ...ladder.slice(Math.max(0, ladder.indexOf(want) + 1))].filter((v, i, a) => a.indexOf(v) === i);
  // text.format=json_object를 쓰려면 입력 메시지에 "json"이라는 말이 있어야 함
  const content = [
    ...images.map((i) => ({ type: "input_image", image_url: `data:${i.media_type};base64,${i.data}`, detail: "high" })),
    { type: "input_text", text: /json/i.test(ask) ? ask : `${ask}\n\n(답은 JSON으로만)` },
  ];
  let lastMsg = "";
  for (const effort of efforts) {
    for (const withFormat of [true, false]) {
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          reasoning: { effort },
          instructions: sys,
          input: [{ role: "user", content }],
          max_output_tokens: 60000,
          ...(withFormat ? { text: { format: { type: "json_object" } } } : {}),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastMsg = j?.error?.message ?? `HTTP ${res.status}`;
        console.error(`[openai] ${model} effort=${effort}${withFormat ? "" : " (no format)"}: ${res.status} ${lastMsg}`);
        if (res.status === 400 && withFormat && /format|json_object/i.test(lastMsg)) continue; // 형식 옵션을 모르면 빼고
        if (res.status === 400 && /effort|reasoning/i.test(lastMsg)) break; // 추론 세기를 모르면 한 단계 낮춰서
        throw new Error(lastMsg);
      }
      type OutItem = { type: string; content?: { type: string; text?: string }[] };
      const text = ((j.output ?? []) as OutItem[])
        .filter((o) => o.type === "message")
        .flatMap((o) => o.content ?? [])
        .filter((c) => c.type === "output_text")
        .map((c) => c.text ?? "")
        .join("");
      if (j.status === "incomplete") console.error(`[openai] incomplete: ${JSON.stringify(j.incomplete_details ?? {})}`);
      if (text.trim()) {
        console.log(`[openai] ${model} effort=${effort} ok (${j.usage?.output_tokens ?? "?"} out tokens)`);
        return text;
      }
      lastMsg = `답이 비어 있음 (${j.status ?? "?"})`;
      break;
    }
  }
  throw new Error(`OpenAI 오류: ${lastMsg}`);
}

let geminiVideoCache: { key: string; models: string[] } | null = null;
/** 유튜브 영상을 직접 볼 수 있는 Gemini 모델들(선호 순). GEMINI_VIDEO_MODEL이 있으면 맨 앞 */
async function geminiVideoModels(key: string): Promise<string[]> {
  if (geminiVideoCache?.key === key) return geminiVideoCache.models;
  const prefer = ["gemini-3.1-pro-preview", "gemini-3-pro-preview", "gemini-2.5-pro", "gemini-3.1-flash", "gemini-3-flash-preview", "gemini-2.5-flash"];
  let avail: string[] = [];
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": key } });
    const j = await res.json();
    avail = ((j.models ?? []) as { name: string; supportedGenerationMethods?: string[] }[])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent") && /gemini-(2\.5|3)/.test(m.name) && !/image|tts|live|audio|embedding|robotics|computer/i.test(m.name))
      .map((m) => m.name.replace(/^models\//, ""));
  } catch (e) {
    console.error(`[gemini] models list failed: ${(e as Error).message}`);
  }
  const ordered = [...prefer.filter((p) => avail.includes(p)), ...avail.filter((a) => !prefer.includes(a) && /pro|flash/.test(a) && !/lite|8b/.test(a))];
  if (!ordered.length) ordered.push("gemini-2.5-pro", "gemini-2.5-flash");
  const forced = Deno.env.get("GEMINI_VIDEO_MODEL")?.trim();
  const models = forced ? [forced, ...ordered.filter((m) => m !== forced)] : ordered;
  console.log(`[gemini] video models: ${models.slice(0, 4).join(", ")}`);
  geminiVideoCache = { key, models };
  return models;
}

/** Gemini에게 유튜브 영상(공개 영상)을 직접 보여 주고 답을 받음. 모델이 안 되면 다음 모델로 */
/** Gemini가 매체(유튜브 링크 file_data 또는 음악 inline_data)를 직접 보고/듣고 답하기 */
async function viaGeminiMedia(mediaPart: Record<string, unknown>, key: string, ask: string, sys: string, deep: boolean, what: "video" | "audio"): Promise<string> {
  const models = await geminiVideoModels(key);
  let lastMsg = "";
  for (const model of models.slice(0, 4)) {
    for (const withThink of [true, false]) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sys }] },
          contents: [{ role: "user", parts: [mediaPart, { text: ask }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0, ...(withThink ? { thinkingConfig: { thinkingBudget: deep ? 16384 : 2048 } } : {}) },
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        lastMsg = j?.error?.message ?? `HTTP ${res.status}`;
        console.error(`[gemini] ${what} ${model}${withThink ? "" : " (no thinking)"}: ${res.status} ${lastMsg}`);
        if (withThink && res.status === 400 && /thinking/i.test(lastMsg)) continue;
        break;
      }
      const text = ((j.candidates?.[0]?.content?.parts ?? []) as { text?: string }[]).map((p) => p.text ?? "").join("");
      if (text.includes("{")) {
        console.log(`[gemini] ${what} ok via ${model}`);
        return text;
      }
      lastMsg = `답이 비어 있음 (${j.candidates?.[0]?.finishReason ?? j.promptFeedback?.blockReason ?? "?"})`;
      console.error(`[gemini] ${what} ${model}: ${lastMsg}`);
      break;
    }
  }
  throw new Error(`${what === "audio" ? "음악을 듣지" : "유튜브 영상을 보지"} 못했어요: ${lastMsg}`);
}

async function viaGemini(images: Img[], key: string, ask = ASK, sys = SYSTEM): Promise<string> {
  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: [{
          role: "user",
          parts: [...images.map((i) => ({ inline_data: { mime_type: i.media_type, data: i.data } })), { text: ask }],
        }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
    },
  );
  const j = await res.json();
  if (!res.ok) throw new Error(j?.error?.message ?? `Gemini 오류 ${res.status}`);
  return (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
}

async function viaClaude(images: Img[], key: string, ask = ASK, sys = SYSTEM): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: Deno.env.get("CLAUDE_MODEL") ?? "claude-sonnet-5-5",
      max_tokens: 8000,
      system: sys,
      messages: [{
        role: "user",
        content: [
          ...images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.media_type, data: i.data } })),
          { type: "text", text: ask },
        ],
      }],
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j?.error?.message ?? `Claude 오류 ${res.status}`);
  return (j.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
}
