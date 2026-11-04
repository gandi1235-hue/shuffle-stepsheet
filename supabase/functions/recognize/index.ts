// Supabase Edge Function: 사진 → 표준 스텝지 JSON (Claude 이미지 인식)
// 배포: supabase functions deploy recognize
// 비밀키: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import Anthropic from "npm:@anthropic-ai/sdk@0.90.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `당신은 셔플댄스/라인댄스 스텝지를 읽어 표준 양식 JSON으로 정리하는 도우미입니다.
사진에는 종이 스텝지, 칠판, 화면 캡처가 올 수 있고 손글씨일 수 있습니다.
반드시 아래 JSON만 출력하세요(설명 금지).
{
  "title": "노래 제목 또는 빈 문자열",
  "artist": "가수 또는 빈 문자열",
  "creator_name": "창작자 이름 또는 빈 문자열",
  "difficulty": "초급|중급|고급|빈 문자열",
  "memo": "주의사항 등 기타 메모",
  "sections": [
    { "name": "인트로|A|B|후렴 등 구간 이름(없으면 '본문')",
      "steps": [ { "name": "스텝 이름", "count": "8×2 같은 카운트 표기", "direction": "방향/비고(없으면 빈 문자열)", "uncertain": false } ] }
  ]
}
읽기 애매한 글자가 있는 스텝은 "uncertain": true 로 표시하세요. 숫자는 보이는 대로 적으세요.`;

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
