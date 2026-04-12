import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType, dogName } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "이미지가 없어요" }, { status: 400 });
    }

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: `강아지 감정 분석가. JSON만 출력.
{"emoji":"1개","title":"감정한줄","sub":"속마음(반말)","badge":"이모지+태그","reasons":[{"icon":"이모지","label":"눈빛/자세/표정","text":"설명"}x3],"moods":[{"name":"행복","pct":N,"color":"#FFB5C8"},{"name":"편안","pct":N,"color":"#B5E8D5"},{"name":"기대","pct":N,"color":"#C9B8F5"},{"name":"불안","pct":N,"color":"#FFE9A0"}]}`,
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

    // IP 주소 추출
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // 이미지를 Supabase Storage에 업로드
    const imageBuffer = Buffer.from(imageBase64, "base64");
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("dog-images")
      .upload(fileName, imageBuffer, { contentType: "image/jpeg" });

    const imageUrl = uploadError
      ? null
      : supabase.storage.from("dog-images").getPublicUrl(fileName).data.publicUrl;

    // DB에 저장
    await supabase.from("analyses").insert({
      dog_name: dogName || null,
      result,
      image_url: imageUrl,
      ip_address: ip,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "분석 실패" }, { status: 500 });
  }
}
