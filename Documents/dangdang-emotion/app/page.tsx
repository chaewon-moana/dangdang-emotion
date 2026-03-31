"use client";

import { useState, useRef, useEffect } from "react";
import html2canvas from "html2canvas";

const AD_SECONDS = 5;
const DAILY_LIMIT = 3;
const STORAGE_KEY = "dangdang_usage";

type Screen = "upload" | "ad" | "result";

interface AnalysisResult {
  emoji: string;
  title: string;
  sub: string;
  badge: string;
  reasons: { icon: string; label: string; text: string }[];
  moods: { name: string; pct: number; color: string }[];
}

function getUsageData(): { count: number; date: string } {
  if (typeof window === "undefined") return { count: 0, date: "" };
  const today = new Date().toISOString().split("T")[0];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { count: 0, date: today };
    const data = JSON.parse(raw);
    if (data.date !== today) return { count: 0, date: today };
    return data;
  } catch {
    return { count: 0, date: today };
  }
}

function incrementUsage() {
  const today = new Date().toISOString().split("T")[0];
  const data = getUsageData();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ count: data.count + 1, date: today })
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("upload");
  const [previewSrc, setPreviewSrc] = useState("");
  const [imgBase64, setImgBase64] = useState("");
  const [mediaType, setMediaType] = useState("image/jpeg");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [timerSec, setTimerSec] = useState(AD_SECONDS);
  const [timerReady, setTimerReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usageCount, setUsageCount] = useState(0);
  const [moodVisible, setMoodVisible] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultRef = useRef<AnalysisResult | null>(null);
  const resultCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUsageCount(getUsageData().count);
  }, []);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const original = e.target?.result as string;
      setPreviewSrc(original);
      const img = new Image();
      img.onload = () => {
        const MAX = 768;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        const resized = canvas.toDataURL("image/jpeg", 0.82);
        setMediaType("image/jpeg");
        setImgBase64(resized.split(",")[1]);
      };
      img.src = original;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  };

  const startFlow = async () => {
    const usage = getUsageData();
    if (usage.count >= DAILY_LIMIT) {
      alert(`오늘 ${DAILY_LIMIT}회를 모두 사용했어요 🥺\n내일 다시 도전해주세요!`);
      return;
    }
    resultRef.current = null;
    setResult(null);
    setTimerSec(AD_SECONDS);
    setTimerReady(false);
    setScreen("ad");
    analyzeInBackground();
    startTimer();
    incrementUsage();
    setUsageCount((prev) => prev + 1);
  };

  const analyzeInBackground = async () => {
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: imgBase64, mediaType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "분석 실패");
      resultRef.current = data;
    } catch {
      resultRef.current = {
        emoji: "🐶",
        title: "분석 중 오류가 생겼어요",
        sub: "다시 시도해주세요!",
        badge: "🔄 다시",
        reasons: [
          { icon: "😅", label: "안내", text: "이미지 분석에 실패했어요." },
          { icon: "📸", label: "팁", text: "강아지 얼굴이 잘 보이는 사진을 올려주세요." },
          { icon: "💡", label: "팁", text: "밝고 선명한 사진이 좋아요." },
        ],
        moods: [
          { name: "행복", pct: 0, color: "#FFB5C8" },
          { name: "편안", pct: 0, color: "#B5E8D5" },
          { name: "기대", pct: 0, color: "#C9B8F5" },
          { name: "불안", pct: 0, color: "#FFE9A0" },
        ],
      };
    }
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    let sec = AD_SECONDS;
    timerRef.current = setInterval(() => {
      sec--;
      setTimerSec(sec);
      if (sec <= 0) {
        clearInterval(timerRef.current!);
        setTimerReady(true);
      }
    }, 1000);
  };

  const showResult = async () => {
    if (!timerReady) return;
    setLoading(true);
    while (!resultRef.current) {
      await new Promise((r) => setTimeout(r, 300));
    }
    setResult(resultRef.current);
    setLoading(false);
    setMoodVisible(false);
    setScreen("result");
    setTimeout(() => setMoodVisible(true), 100);
  };

  const handleShare = async () => {
    if (!resultCardRef.current) return;
    const canvas = await html2canvas(resultCardRef.current, { useCORS: true, scale: 2 });
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "dangdang-emotion.png", { type: "image/png" });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "댕댕 감정연구소", text: `${result?.emoji} ${result?.title}` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "dangdang-emotion.png";
        a.click();
        URL.revokeObjectURL(url);
      }
    }, "image/png");
  };

  const retry = () => {
    setScreen("upload");
    setPreviewSrc("");
    setImgBase64("");
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const remaining = Math.max(0, DAILY_LIMIT - usageCount);
  const timerPct = timerSec / AD_SECONDS;

  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-50 to-blue-100 p-4">
      <div className="max-w-md mx-auto">

        {/* 업로드 스크린 */}
        {screen === "upload" && (
          <div>
            <div className="text-center py-8">
              <span className="text-5xl block animate-bounce">🐾</span>
              <h1 className="font-bold text-3xl text-purple-900 mt-2" style={{ fontFamily: "cursive" }}>
                우리 강아지 감정은?
              </h1>
              <p className="text-sm text-purple-400 mt-1">사진 한 장으로 강아지 속마음을 읽어드려요</p>
              <p className="text-xs text-purple-300 mt-1">오늘 남은 횟수: {remaining}/{DAILY_LIMIT}회</p>
            </div>

            <div
              className={`bg-white rounded-3xl p-8 text-center border-2 border-dashed cursor-pointer transition-all duration-300 ${
                previewSrc
                  ? "border-green-300"
                  : "border-pink-300 hover:border-purple-300 hover:shadow-xl hover:-translate-y-1"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              {!previewSrc ? (
                <>
                  <span className="text-5xl block mb-3">📸</span>
                  <p className="text-xl text-purple-800" style={{ fontFamily: "cursive" }}>
                    강아지 사진을 올려주세요
                  </p>
                  <p className="text-xs text-purple-300 mt-1">JPG, PNG 모두 가능해요</p>
                </>
              ) : (
                <>
                  <img src={previewSrc} alt="미리보기" className="w-full max-h-64 object-cover rounded-2xl" />
                  <button
                    className="mt-3 text-xs text-purple-400 border border-purple-200 px-3 py-1 rounded-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    📷 사진 바꾸기
                  </button>
                </>
              )}
            </div>

            {previewSrc && (
              <button
                onClick={startFlow}
                disabled={remaining <= 0}
                className="w-full mt-4 py-4 bg-gradient-to-r from-pink-400 to-purple-400 text-white rounded-2xl text-lg font-bold shadow-lg shadow-pink-200 hover:-translate-y-1 hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                style={{ fontFamily: "cursive" }}
              >
                {remaining <= 0 ? "😢 오늘 횟수를 모두 사용했어요" : "🔍 감정 분석하기"}
              </button>
            )}
          </div>
        )}

        {/* 광고 스크린 */}
        {screen === "ad" && (
          <div className="mt-4">
            <div className="bg-white rounded-3xl overflow-hidden shadow-2xl shadow-purple-100">
              <div className="bg-gradient-to-br from-pink-50 to-purple-50 p-6 text-center">
                {previewSrc && (
                  <img
                    src={previewSrc}
                    alt="강아지"
                    className="w-20 h-20 rounded-full object-cover mx-auto border-4 border-white shadow-md mb-3"
                  />
                )}
                <p className="text-lg text-purple-800" style={{ fontFamily: "cursive" }}>
                  🔍 강아지 감정 분석 중...
                </p>
                <div className="flex justify-center gap-2 mt-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${i === 0 ? "bg-pink-400" : "bg-purple-200"}`}
                    />
                  ))}
                </div>
              </div>

              {/* 광고 슬롯 */}
              <div className="mx-4 my-4 border-2 border-dashed border-purple-100 rounded-2xl min-h-40 flex flex-col items-center justify-center gap-2 p-6 text-center">
                <span className="text-xs text-gray-300 tracking-widest uppercase">AD</span>
                <span className="text-4xl">🐶</span>
                <p className="text-xl text-purple-800" style={{ fontFamily: "cursive" }}>
                  댕댕이 간식 브랜드
                </p>
                <p className="text-sm text-purple-400 leading-relaxed">
                  우리 강아지에게 딱 맞는
                  <br />
                  건강한 간식을 추천해드려요
                </p>
                <span className="bg-gradient-to-r from-pink-400 to-purple-400 text-white text-xs px-3 py-1 rounded-full font-bold">
                  지금 할인 중
                </span>
              </div>

              {/* 타이머 */}
              <div className="px-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-purple-300">잠시 후 결과를 보여드릴게요</span>
                  <div className="relative w-9 h-9 flex items-center justify-center">
                    <svg className="absolute top-0 left-0 w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="#f3f0ff" strokeWidth="2.5" />
                      <circle
                        cx="18" cy="18" r="15" fill="none"
                        stroke="#C9B8F5" strokeWidth="2.5"
                        strokeDasharray="94.2"
                        strokeDashoffset={94.2 * (1 - timerPct)}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="text-sm text-purple-800 relative z-10 font-bold">{timerSec}</span>
                  </div>
                </div>
                <div className="h-2 bg-purple-50 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-400 transition-all duration-1000"
                    style={{ width: `${timerPct * 100}%` }}
                  />
                </div>
                <button
                  onClick={showResult}
                  disabled={!timerReady || loading}
                  className={`w-full py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${
                    timerReady && !loading
                      ? "bg-gradient-to-r from-green-300 to-teal-300 text-teal-800 hover:-translate-y-1 hover:shadow-lg cursor-pointer"
                      : "bg-purple-50 text-purple-300 cursor-not-allowed"
                  }`}
                  style={{ fontFamily: "cursive" }}
                >
                  {loading
                    ? "⏳ 분석 마무리 중..."
                    : timerReady
                    ? "🎉 결과 보러 가기!"
                    : "⏳ 결과 기다리는 중..."}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 결과 스크린 */}
        {screen === "result" && result && (
          <div className="mt-4">
            <div ref={resultCardRef} className="bg-white rounded-3xl overflow-hidden shadow-2xl shadow-purple-100">
              <div className="relative">
                <img src={previewSrc} alt="분석된 강아지" className="w-full h-56 object-cover" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 bg-white rounded-full px-4 py-2 text-sm font-bold text-purple-800 shadow-lg whitespace-nowrap">
                  {result.badge}
                </div>
              </div>

              <div className="pt-10 px-6 pb-6">
                <div className="text-center mb-5">
                  <span className="text-5xl block animate-bounce">{result.emoji}</span>
                  <h2
                    className="text-2xl font-bold text-purple-900 mt-2"
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
                          className="h-full rounded-full transition-all duration-1000"
                          style={{
                            width: moodVisible ? `${m.pct}%` : "0%",
                            background: m.color,
                          }}
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

            <p className="text-center text-xs text-purple-300 mt-3">
              오늘 남은 횟수: {remaining}/{DAILY_LIMIT}회
            </p>

            <button
              onClick={handleShare}
              className="w-full mt-3 py-3 bg-gradient-to-r from-pink-400 to-purple-400 text-white rounded-2xl text-sm font-bold hover:-translate-y-1 hover:shadow-lg transition-all"
            >
              공유하기
            </button>

            <button
              onClick={retry}
              className="w-full mt-3 py-3 bg-transparent border border-purple-200 text-purple-400 rounded-2xl text-sm font-medium hover:bg-purple-50 transition-all"
            >
              ↩ 다른 사진 분석하기
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
