// Supabase Edge Function: 사진 → 셔플박스 표준 양식 스텝지 JSON (비정형 스텝지도 내용을 빠뜨리지 않고 옮김)
// 대시보드 Edge Functions > Deploy a new function > Via Editor 에서 이름 "recognize"로 이 파일 내용을 붙여 넣어 배포합니다.
// 비밀키(Edge Functions > Secrets) 중 하나만 넣으면 됩니다:
//   GEMINI_API_KEY    : Google AI Studio 무료 키 (https://aistudio.google.com/apikey)
//   ANTHROPIC_API_KEY : Claude API 키 (https://console.anthropic.com)
// 선택: GEMINI_MODEL (기본 gemini-2.5-flash), CLAUDE_MODEL (기본 claude-sonnet-5-5), OPENAI_API_KEY (있으면 말 받아 적기에 Whisper 계열 사용, OPENAI_STT_MODEL 기본 gpt-4o-transcribe)

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
    const who = auth.startsWith("Bearer ")
      ? await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, { headers: { apikey, Authorization: auth } }).then((r) => r.ok).catch(() => false)
      : false;
    if (!who) {
      return new Response(JSON.stringify({ error: "로그인이 필요해요" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const body = await req.json() as { images?: { media_type: string; data: string }[]; title?: string; order_request?: string; lines?: string[]; avatar?: { media_type: string; data: string }; edit_request?: string; sheet?: { lines: unknown[]; memo?: string }; audio?: { media_type: string; data: string; hint?: string } };
    const geminiKey = findKey(/gemini|google/i);
    const claudeKey = findKey(/ant.?h?rop|claude/i);

    // 아바타 모드: { avatar: {media_type, data} } — 사진 속 사람을 귀여운 전신 캐릭터로 (Gemini 이미지 모델)
    // 모델 이름이 바뀌어도 되게: 키로 쓸 수 있는 모델 목록에서 이미지 생성 모델을 찾아 차례로 시도
    if (body.avatar?.data) {
      if (!geminiKey) throw new Error("AI 아바타는 Gemini 키가 있어야 만들 수 있어요");
      const prompt = "Turn the person in this photo into a cute chibi-style full-body 3D-cartoon dance character (soft Pixar-like sticker look). Big head and small body (about 2.5 heads tall), head near the top of the frame, whole body visible down to the shoes, standing in a playful shuffle-dance pose on a simple floor, facing the camera, smiling. Keep their recognizable features: hair style and color, glasses, face shape, skin tone, age, and the outfit colors from the photo. Plain soft pastel background, portrait 3:4, no text, no watermark.";
      const candidates = await imageModels(geminiKey);
      if (!candidates.length) throw new Error("이 Gemini 키로 쓸 수 있는 이미지 생성 모델이 없어요 (AI Studio에서 결제/한도를 확인해 주세요)");
      const errors: string[] = [];
      for (const model of candidates) {
        for (const withCfg of [true, false]) {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
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
      const openaiKey = findKey(/openai/i);
      const hint = body.audio.hint ?? "셔플댄스 스텝지 앱에서 말한 요청. 스텝 이름(런닝맨, 티스텝, 찰스턴, 크리스크로스, 글라이드, 킥볼체인지, 스핀), 박수(4박, 8박), 줄 번호, 초, BPM이 자주 나옴.";
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
- 스텝 이름은 스텝지에서 이미 쓰는 표기를 따르고, 박수를 말하면 beats에 숫자만 적습니다("4박" → "4").
- "지워", "빼" → 그 줄이나 스텝을 삭제. "추가", "넣어", "아래에" → 그 자리에 새 줄/스텝. "바꿔", "대신" → 교체. "해설", "메모", "손동작" → notes에 추가/수정.
- 요청이 가리키는 줄을 찾을 수 없거나 뜻을 알 수 없으면 lines를 원본 그대로 두고 unclear에 짧게 되묻는 말(한국어)을 적습니다. 그 밖에는 unclear를 빈 문자열로.
반드시 JSON {"lines":[...], "note":"바뀐 점 한 줄(한국어, 25자 내)", "unclear":""} 만 출력합니다.`;
      const ask = `[스텝지]\n${JSON.stringify({ lines: body.sheet.lines, memo: body.sheet.memo ?? "" })}\n\n[요청]\n${String(body.edit_request).trim()}`;
      const t = geminiKey ? await viaGemini([], geminiKey, ask, sys) : claudeKey ? await viaClaude([], claudeKey, ask, sys) : "";
      const s0 = t.indexOf("{"); const e0 = t.lastIndexOf("}");
      const j = s0 >= 0 ? JSON.parse(t.slice(s0, e0 + 1)) : {};
      return new Response(JSON.stringify({ lines: Array.isArray(j.lines) ? j.lines : null, note: j.note ?? "", unclear: j.unclear ?? "" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 직접 요청 모드: { order_request, lines } — 비정형 요청을 춤추는 계획(줄 순서·쉼·길이·시작 시각·박자)으로
    if (body.order_request && body.lines?.length) {
      const sys = `당신은 셔플댄스 스텝지와 실제 영상/노래의 타이밍을 맞춰 주는 도우미입니다. 스텝 줄 목록(번호는 1부터, 괄호 안은 그 줄의 박수)과 사용자의 요청(말로 한 것을 받아 적은 글이라 띄어쓰기·조사가 어색할 수 있음)을 읽고, 영상/노래에서 실제로 춤추는 차례를 plan 배열로 적습니다.

plan 항목 종류:
- {"line": N} : N번 줄을 춤 (한 줄 = 그 줄의 박수만큼 시간이 흐름)
- {"line": N, "beats": B} : N번 줄을 평소와 다른 박수 B만큼 (예: "3번은 16박으로 길게", "2번은 반만")
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
      const t = geminiKey ? await viaGemini([], geminiKey, ask, sys) : claudeKey ? await viaClaude([], claudeKey, ask, sys) : "";
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
      const t = geminiKey ? await viaGemini([], geminiKey, q) : claudeKey ? await viaClaude([], claudeKey, q) : "";
      const s0 = t.indexOf("{"); const e0 = t.lastIndexOf("}");
      const artist = s0 >= 0 ? String(JSON.parse(t.slice(s0, e0 + 1)).artist ?? "") : "";
      return new Response(JSON.stringify({ artist }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const images = body.images ?? [];
    if (!images.length) throw new Error("이미지가 없습니다");
    const text = geminiKey
      ? await viaGemini(images, geminiKey)
      : claudeKey
        ? await viaClaude(images, claudeKey)
        : (() => { throw new Error("AI 키가 설정되지 않았습니다 (GEMINI_API_KEY 또는 ANTHROPIC_API_KEY)"); })();

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


// 비밀키 이름을 조금 다르게 적어도(예: "antrophic key") 찾도록 이름에 관계없이 패턴으로 검색
function findKey(pattern: RegExp): string | undefined {
  const env = Deno.env.toObject();
  const hit = Object.entries(env).find(([k, v]) => pattern.test(k) && !k.startsWith("SUPABASE_") && v.trim());
  return hit?.[1].trim();
}
const ASK = "이 스텝지를 위 양식의 JSON으로 정리해 주세요.";

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
