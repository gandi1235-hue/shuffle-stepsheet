// Supabase Edge Function: 사진 → 협회 양식 스텝지 JSON
// 대시보드 Edge Functions > Deploy a new function > Via Editor 에서 이름 "recognize"로 이 파일 내용을 붙여 넣어 배포합니다.
// 비밀키(Edge Functions > Secrets) 중 하나만 넣으면 됩니다:
//   GEMINI_API_KEY    : Google AI Studio 무료 키 (https://aistudio.google.com/apikey)
//   ANTHROPIC_API_KEY : Claude API 키 (https://console.anthropic.com)
// 선택: GEMINI_MODEL (기본 gemini-2.5-flash), CLAUDE_MODEL (기본 claude-sonnet-5-5)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `당신은 셔플댄스 스텝지(대한셔플댄스협회 양식)를 읽어 JSON으로 정리하는 도우미입니다.
사진에는 종이 스텝지, 칠판, 화면 캡처가 올 수 있고 손글씨일 수 있습니다.
양식: 머리말 표에 "응시자: 이름/기수/지부", "안무곡: 노래 제목 / 가수"가 있고,
본문은 한 줄에 스텝 1~2개가 "스텝이름 (4박)" 형태로 적혀 있습니다. 마지막에 "마무리", "참고: ..."가 올 수 있습니다.
반드시 아래 JSON만 출력하세요(설명 금지).
{
  "title": "안무곡(노래 제목) 또는 빈 문자열",
  "artist": "가수(원곡) 또는 빈 문자열",
  "creator_name": "응시자 이름(첫 번째 '/' 앞) 또는 빈 문자열",
  "creator_info": "이름 뒤의 기수/지부 (예: '34기/대구수성') 또는 빈 문자열",
  "memo": "참고 줄의 내용(없으면 빈 문자열)",
  "lines": [
    { "steps": [ { "name": "스텝 이름(사진에 적힌 그대로, 예: '전주 - ok 후 바운스', 'T스텝 오 왼')", "beats": "4박", "uncertain": false } ] }
  ]
}
규칙: 사진의 한 줄은 lines의 한 항목으로, 그 줄의 스텝들은 steps에 순서대로 넣습니다. "마무리" 줄은 lines에 넣지 않습니다.
읽기 애매한 글자는 "uncertain": true 로 표시하세요. 박수는 "(4박)"처럼 괄호 안 숫자를 "4박" 형식으로 적습니다.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { images } = await req.json() as { images: { media_type: string; data: string }[] };
    if (!images?.length) throw new Error("이미지가 없습니다");

    const text = Deno.env.get("GEMINI_API_KEY")
      ? await viaGemini(images)
      : Deno.env.get("ANTHROPIC_API_KEY")
        ? await viaClaude(images)
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
const ASK = "이 스텝지를 위 양식의 JSON으로 정리해 주세요.";

async function viaGemini(images: Img[]): Promise<string> {
  const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": Deno.env.get("GEMINI_API_KEY")! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{
          role: "user",
          parts: [...images.map((i) => ({ inline_data: { mime_type: i.media_type, data: i.data } })), { text: ASK }],
        }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
    },
  );
  const j = await res.json();
  if (!res.ok) throw new Error(j?.error?.message ?? `Gemini 오류 ${res.status}`);
  return (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
}

async function viaClaude(images: Img[]): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: Deno.env.get("CLAUDE_MODEL") ?? "claude-sonnet-5-5",
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{
        role: "user",
        content: [
          ...images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.media_type, data: i.data } })),
          { type: "text", text: ASK },
        ],
      }],
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j?.error?.message ?? `Claude 오류 ${res.status}`);
  return (j.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
}
