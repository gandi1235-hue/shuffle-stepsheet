// Supabase Edge Function: 사진 → 표준 스텝지 JSON (Claude 이미지 인식)
// 배포: supabase functions deploy recognize
// 비밀키: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import Anthropic from "npm:@anthropic-ai/sdk@0.90.0";

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

    const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
    const content: Anthropic.MessageParam["content"] = [
      ...images.map((img) => ({
        type: "image" as const,
        source: { type: "base64" as const, media_type: img.media_type as "image/jpeg", data: img.data },
      })),
      { type: "text", text: "이 스텝지를 표준 양식 JSON으로 정리해 주세요." },
    ];

    const msg = await client.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });

    const text = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
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
