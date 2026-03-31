import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "이미지가 없어요" }, { status: 400 });
    }

    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 400,
      system: `강아지 감정 전문가입니다. 반드시 아래 JSON만 반환하세요. 다른 텍스트 없이.
{
  "emoji":"이모지1개",
  "title":"핵심감정한줄 (예: 나만 봐줘! 모드)",
  "sub":"속마음한문장(반말체, 귀엽게)",
  "badge":"이모지+짧은태그 (예: 🥺 애교쟁이)",
  "reasons":[
    {"icon":"이모지","label":"눈빛","text":"분석내용"},
    {"icon":"이모지","label":"자세","text":"분석내용"},
    {"icon":"이모지","label":"표정","text":"분석내용"}
  ],
  "moods":[
    {"name":"행복","pct":숫자,"color":"#FFB5C8"},
    {"name":"편안","pct":숫자,"color":"#B5E8D5"},
    {"name":"기대","pct":숫자,"color":"#C9B8F5"},
    {"name":"불안","pct":숫자,"color":"#FFE9A0"}
  ]
}`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType || "image/jpeg",
                data: imageBase64,
              },
            },
            { type: "text", text: "이 강아지의 감정을 분석해주세요." },
          ],
        },
      ],
    });

    const text = response.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const clean = text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);

    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "분석 실패" }, { status: 500 });
  }
}
