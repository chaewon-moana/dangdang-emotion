import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import ShareButtons from "./share-buttons";

interface AnalysisResult {
  emoji: string;
  title: string;
  sub: string;
  badge: string;
  reasons: { icon: string; label: string; text: string }[];
  moods: { name: string; pct: number; color: string }[];
}

async function getAnalysis(id: string) {
  const { data, error } = await supabase
    .from("analyses")
    .select("dog_name, result, image_url, created_at")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getAnalysis(id);

  if (!data) {
    return { title: "댕댕 감정연구소" };
  }

  const result = data.result as AnalysisResult;
  const dogName = data.dog_name as string | null;
  const title = dogName
    ? `${result.emoji} ${dogName}의 감정: ${result.title}`
    : `${result.emoji} ${result.title}`;
  const description = result.sub;
  const imageUrl = data.image_url as string | null;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(imageUrl && { images: [{ url: imageUrl, width: 768, height: 768 }] }),
      type: "article",
      siteName: "댕댕 감정연구소",
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      ...(imageUrl && { images: [imageUrl] }),
    },
  };
}

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getAnalysis(id);

  if (!data) notFound();

  const result = data.result as AnalysisResult;
  const dogName = data.dog_name as string | null;
  const imageUrl = data.image_url as string | null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-50 to-blue-100 p-4">
      <div className="max-w-md mx-auto mt-4">
        <div className="bg-white rounded-3xl overflow-hidden shadow-2xl shadow-purple-100">
          {imageUrl && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="강아지" className="w-full h-56 object-cover" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-white rounded-full px-4 py-2 text-sm font-bold text-purple-800 shadow-lg whitespace-nowrap">
                {result.badge}
              </div>
            </div>
          )}

          <div className={`${imageUrl ? "pt-10" : "pt-6"} px-6 pb-6`}>
            <div className="text-center mb-5">
              <span className="text-5xl block animate-bounce">{result.emoji}</span>
              {dogName && (
                <p className="text-base font-bold text-pink-400 mt-2">
                  {dogName}이(가) 지금...
                </p>
              )}
              <h2
                className="text-2xl font-bold text-purple-900 mt-1"
                style={{ fontFamily: "cursive" }}
              >
                {result.title}
              </h2>
              <p className="text-sm text-purple-400 mt-1">{result.sub}</p>
            </div>

            <div className="flex flex-col gap-2 mb-5">
              {result.reasons.map((r, i) => (
                <div key={i} className="flex items-start gap-3 bg-pink-50 rounded-2xl p-3">
                  <span className="text-lg flex-shrink-0">{r.icon}</span>
                  <div>
                    <span className="text-xs font-bold text-purple-300 block">{r.label}</span>
                    <span className="text-sm text-purple-800 leading-relaxed">{r.text}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-5">
              <p className="text-xs text-purple-300 font-medium mb-2">감정 지수</p>
              {result.moods.map((m, i) => (
                <div key={i} className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs text-purple-700 w-10">{m.name}</span>
                  <div className="flex-1 h-2 bg-purple-50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${m.pct}%`, background: m.color }}
                    />
                  </div>
                  <span className="text-xs text-purple-300 w-7 text-right">{m.pct}%</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-purple-50 pt-4">
              <span className="text-sm text-purple-200" style={{ fontFamily: "cursive" }}>
                🐾 댕댕 감정연구소
              </span>
              <span className="text-sm">🐾🐾🐾</span>
            </div>
          </div>
        </div>

        <ShareButtons
          resultId={id}
          title={result.title}
          emoji={result.emoji}
          sub={result.sub}
          imageUrl={imageUrl}
          dogName={dogName}
        />

        <Link
          href="/"
          className="block w-full mt-3 py-3 bg-transparent border border-purple-200 text-purple-400 rounded-2xl text-sm font-medium text-center hover:bg-purple-50 transition-all"
        >
          🐾 나도 분석해보기
        </Link>
      </div>
    </main>
  );
}
