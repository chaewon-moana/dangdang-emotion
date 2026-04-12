"use client";

import { useState, useRef, useEffect } from "react";
import html2canvas from "html2canvas";

declare global {
  interface Window {
    Kakao?: {
      isInitialized: () => boolean;
      init: (key: string) => void;
      Share: {
        sendDefault: (options: Record<string, unknown>) => void;
      };
    };
  }
}

const AD_SECONDS = 5;
const DAILY_LIMIT = 2;

type Screen = "upload" | "ad" | "result";

interface AnalysisResult {
  emoji: string;
  title: string;
  sub: string;
  badge: string;
  reasons: { icon: string; label: string; text: string }[];
  moods: { name: string; pct: number; color: string }[];
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
  const [moodVisible, setMoodVisible] = useState(false);
  const [dogName, setDogName] = useState("");
  const [limitReached, setLimitReached] = useState(false);
  const [snsConsent, setSnsConsent] = useState(false);
  const [resultId, setResultId] = useState<number | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultRef = useRef<AnalysisResult | null>(null);
  const resultCardRef = useRef<HTMLDivElement>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);

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
    resultRef.current = null;
    setResult(null);
    setTimerSec(AD_SECONDS);
    setTimerReady(false);
    setLimitReached(false);
    setScreen("ad");
    analyzeInBackground();
    startTimer();
  };

  const analyzeInBackground = async () => {
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: imgBase64, mediaType, dogName, snsConsent }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setLimitReached(true);
        resultRef.current = {
          emoji: "😢",
          title: "오늘 분석 횟수를 모두 사용했어요",
          sub: `하루 ${DAILY_LIMIT}회까지 무료예요. 내일 다시 만나요!`,
          badge: "🔒 오늘 마감",
          reasons: [
            { icon: "📊", label: "안내", text: `하루 ${DAILY_LIMIT}회 무료 분석이 제공돼요.` },
            { icon: "⏰", label: "초기화", text: "자정이 지나면 횟수가 초기화돼요." },
            { icon: "💕", label: "내일 봐요", text: "내일 또 강아지 감정을 분석해보세요!" },
          ],
          moods: [
            { name: "행복", pct: 0, color: "#FFB5C8" },
            { name: "편안", pct: 0, color: "#B5E8D5" },
            { name: "기대", pct: 0, color: "#C9B8F5" },
            { name: "불안", pct: 0, color: "#FFE9A0" },
          ],
        };
        return;
      }
      if (!res.ok) throw new Error(data.error || "분석 실패");
      setResultId(data.id ?? null);
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

  useEffect(() => {
    if (timerReady && screen === "ad") {
      showResult();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerReady]);

  const [sharing, setSharing] = useState(false);

  const getShareUrl = () => `${window.location.origin}/result/${resultId}`;

  const handleKakaoShare = () => {
    if (!result || !resultId) return;
    const Kakao = window.Kakao;
    if (!Kakao) {
      alert("카카오 SDK를 불러오는 중이에요. 잠시 후 다시 시도해주세요.");
      return;
    }
    if (!Kakao.isInitialized()) {
      Kakao.init(process.env.NEXT_PUBLIC_KAKAO_JS_KEY || "");
    }
    const shareUrl = getShareUrl();
    const shareTitle = dogName
      ? `${result.emoji} ${dogName}의 감정: ${result.title}`
      : `${result.emoji} ${result.title}`;
    Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title: shareTitle,
        description: result.sub,
        imageUrl: "",
        link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
      },
      buttons: [
        { title: "결과 보기", link: { mobileWebUrl: shareUrl, webUrl: shareUrl } },
        { title: "나도 분석하기", link: { mobileWebUrl: window.location.origin, webUrl: window.location.origin } },
      ],
    });
  };

  const handleCopyLink = async () => {
    if (!resultId) return;
    await navigator.clipboard.writeText(getShareUrl());
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!shareCardRef.current || !result) return;
    setSharing(true);
    try {
      const canvas = await html2canvas(shareCardRef.current, {
        useCORS: true,
        allowTaint: true,
        scale: 3,
        backgroundColor: null,
        logging: false,
      });
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], "dangdang-emotion.png", { type: "image/png" });
        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "댕댕 감정연구소", text: `${result.emoji} ${result.title}` });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "dangdang-emotion.png";
          a.click();
          URL.revokeObjectURL(url);
        }
        setSharing(false);
      }, "image/png");
    } catch {
      setSharing(false);
    }
  };

  const retry = () => {
    setScreen("upload");
    setPreviewSrc("");
    setImgBase64("");
    setResult(null);
    setResultId(null);
    setDogName("");
    setSnsConsent(false);
    setLinkCopied(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const timerPct = timerSec / AD_SECONDS;

  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-50 to-blue-100 p-4">
      <div className="max-w-md mx-auto">

        {/* 업로드 스크린 */}
        {screen === "upload" && (
          <div>
            <div className="text-center py-8">
              <span className="text-5xl block animate-bounce select-none">🐾</span>
              <h1 className="font-bold text-3xl text-purple-900 mt-2" style={{ fontFamily: "cursive" }}>
                우리 강아지 감정은?
              </h1>
              <p className="text-sm text-purple-400 mt-1">사진 한 장으로 강아지 속마음을 읽어드려요</p>
              <p className="text-xs text-purple-300 mt-1">하루 {DAILY_LIMIT}회 무료</p>
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

            <div className="mt-4">
              <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm border border-pink-100">
                <span className="text-2xl">🐶</span>
                <input
                  type="text"
                  value={dogName}
                  onChange={(e) => setDogName(e.target.value)}
                  placeholder="강아지 이름을 입력해주세요"
                  maxLength={10}
                  className="flex-1 text-sm text-purple-800 placeholder-purple-200 outline-none bg-transparent"
                />
              </div>
            </div>

            {previewSrc && (
              <>
                <label className="flex items-start gap-3 mt-4 bg-white rounded-2xl px-4 py-3 shadow-sm border border-pink-100 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={snsConsent}
                    onChange={(e) => setSnsConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-purple-400 flex-shrink-0"
                  />
                  <span className="text-xs text-purple-600 leading-relaxed">
                    🏆 내 새끼 자랑 컨텐츠에 올려도 괜찮아요! (SNS 공유 동의)
                  </span>
                </label>
                <button
                  onClick={startFlow}
                  className="w-full mt-3 py-4 bg-gradient-to-r from-pink-400 to-purple-400 text-white rounded-2xl text-lg font-bold shadow-lg shadow-pink-200 hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
                  style={{ fontFamily: "cursive" }}
                >
                  🔍 감정 분석하기
                </button>
              </>
            )}
          </div>
        )}

        {/* 대기 스크린 */}
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
                  결과를 분석 중이에요...
                </p>
                <div className="flex justify-center gap-1.5 mt-3">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-purple-300 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>

              {/* 쿠팡 파트너스 배너 */}
              <div className="mx-4 my-4">
                {/* TODO: 쿠팡 파트너스 배너 링크로 교체 */}
                <a
                  href="#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block border-2 border-dashed border-purple-100 rounded-2xl min-h-48 flex flex-col items-center justify-center gap-2 p-6 text-center hover:border-purple-200 transition-colors"
                >
                  <span className="text-xs text-gray-300 tracking-widest uppercase">AD</span>
                  <span className="text-4xl">🛒</span>
                  <p className="text-sm text-purple-300">쿠팡 파트너스 배너 영역</p>
                  <p className="text-xs text-purple-200">이 포스팅은 쿠팡 파트너스 활동의 일환으로,<br/>이에 따른 일정액의 수수료를 제공받습니다.</p>
                </a>
              </div>

              {/* 타이머 */}
              <div className="px-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-purple-300">
                    {loading ? "분석 마무리 중..." : `${timerSec}초 후 결과를 보여드릴게요`}
                  </span>
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
                <div className="h-2 bg-purple-50 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-400 transition-all duration-1000"
                    style={{ width: `${timerPct * 100}%` }}
                  />
                </div>
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

            {!limitReached && resultId && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleKakaoShare}
                  className="flex-1 py-3 bg-[#FEE500] text-[#3C1E1E] rounded-2xl text-sm font-bold hover:-translate-y-1 hover:shadow-lg transition-all flex items-center justify-center gap-1.5"
                >
                  💬 카카오톡
                </button>
                <button
                  onClick={handleShare}
                  disabled={sharing}
                  className="flex-1 py-3 bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white rounded-2xl text-sm font-bold hover:-translate-y-1 hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  📸 인스타
                </button>
                <button
                  onClick={handleCopyLink}
                  className="flex-1 py-3 bg-purple-100 text-purple-600 rounded-2xl text-sm font-bold hover:-translate-y-1 hover:shadow-lg transition-all flex items-center justify-center gap-1.5"
                >
                  {linkCopied ? "✅ 복사됨" : "🔗 링크"}
                </button>
              </div>
            )}

            <button
              onClick={retry}
              className="w-full mt-3 py-3 bg-transparent border border-purple-200 text-purple-400 rounded-2xl text-sm font-medium hover:bg-purple-50 transition-all"
            >
              ↩ 다른 사진 분석하기
            </button>
          </div>
        )}
      </div>

      {/* 공유 전용 카드 (화면 밖 렌더링) */}
      {result && previewSrc && (
        <div style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1 }}>
          <div
            ref={shareCardRef}
            style={{
              width: 390,
              background: "linear-gradient(145deg, #fdf2f8 0%, #f5f0ff 50%, #eff6ff 100%)",
              borderRadius: 32,
              overflow: "hidden",
              fontFamily: "sans-serif",
            }}
          >
            {/* 강아지 사진 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc}
              alt="강아지"
              style={{ width: "100%", height: 280, objectFit: "cover", display: "block" }}
            />

            {/* 배지 */}
            <div style={{ textAlign: "center", marginTop: -18 }}>
              <span style={{
                display: "inline-block",
                background: "white",
                borderRadius: 99,
                padding: "6px 18px",
                fontSize: 13,
                fontWeight: 700,
                color: "#6d28d9",
                boxShadow: "0 4px 12px rgba(109,40,217,0.15)",
              }}>
                {result.badge}
              </span>
            </div>

            {/* 메인 감정 */}
            <div style={{ textAlign: "center", padding: "16px 24px 8px" }}>
              <div style={{ fontSize: 52, lineHeight: 1.2 }}>{result.emoji}</div>
              {dogName && (
                <div style={{ fontSize: 14, fontWeight: 700, color: "#f472b6", marginTop: 8 }}>
                  {dogName}이(가) 지금...
                </div>
              )}
              <div style={{ fontSize: 22, fontWeight: 800, color: "#4c1d95", marginTop: 4 }}>{result.title}</div>
              <div style={{ fontSize: 13, color: "#a78bfa", marginTop: 4 }}>{result.sub}</div>
            </div>

            {/* 이유 카드들 */}
            <div style={{ padding: "8px 20px" }}>
              {result.reasons.map((r, i) => (
                <div key={i} style={{
                  display: "flex", gap: 10, alignItems: "flex-start",
                  background: "#fff0f6", borderRadius: 16, padding: "10px 14px", marginBottom: 8,
                }}>
                  <span style={{ fontSize: 18 }}>{r.icon}</span>
                  <div>
                    <div style={{ fontSize: 11, color: "#c4b5fd", fontWeight: 700 }}>{r.label}</div>
                    <div style={{ fontSize: 13, color: "#5b21b6", lineHeight: 1.4 }}>{r.text}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 감정 지수 */}
            <div style={{ padding: "4px 20px 16px" }}>
              <div style={{ fontSize: 11, color: "#c4b5fd", fontWeight: 600, marginBottom: 8 }}>감정 지수</div>
              {result.moods.map((m, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "#7c3aed", width: 32 }}>{m.name}</span>
                  <div style={{ flex: 1, height: 8, background: "#f3f0ff", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ width: `${m.pct}%`, height: "100%", background: m.color, borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 11, color: "#c4b5fd", width: 28, textAlign: "right" }}>{m.pct}%</span>
                </div>
              ))}
            </div>

            {/* 브랜딩 */}
            <div style={{
              borderTop: "1px solid #f3f0ff", margin: "0 20px",
              padding: "12px 0",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 13, color: "#ddd6fe" }}>🐾 댕댕 감정연구소</span>
              <span style={{ fontSize: 12, color: "#ddd6fe" }}>dangdang-emotion.vercel.app</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
