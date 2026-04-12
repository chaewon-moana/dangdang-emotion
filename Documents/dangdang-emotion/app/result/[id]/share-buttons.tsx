"use client";

import { useState } from "react";

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

interface ShareButtonsProps {
  resultId: string;
  title: string;
  emoji: string;
  sub: string;
  imageUrl: string | null;
  dogName: string | null;
}

export default function ShareButtons({ resultId, title, emoji, sub, imageUrl, dogName }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/result/${resultId}`
    : `/result/${resultId}`;

  const shareTitle = dogName
    ? `${emoji} ${dogName}의 감정: ${title}`
    : `${emoji} ${title}`;

  const handleKakao = () => {
    const Kakao = window.Kakao;
    if (!Kakao) {
      alert("카카오 SDK를 불러오는 중이에요. 잠시 후 다시 시도해주세요.");
      return;
    }
    if (!Kakao.isInitialized()) {
      Kakao.init(process.env.NEXT_PUBLIC_KAKAO_JS_KEY || "");
    }
    Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title: shareTitle,
        description: sub,
        imageUrl: imageUrl || "",
        link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
      },
      buttons: [
        { title: "결과 보기", link: { mobileWebUrl: shareUrl, webUrl: shareUrl } },
        { title: "나도 분석하기", link: { mobileWebUrl: shareUrl.replace(`/result/${resultId}`, ""), webUrl: shareUrl.replace(`/result/${resultId}`, "") } },
      ],
    });
  };

  const handleInstaSave = async () => {
    if (!imageUrl) return;
    setSaving(true);
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const file = new File([blob], "dangdang-emotion.jpg", { type: "image/jpeg" });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: shareTitle,
          text: `${shareTitle}\n${sub}\n\n${shareUrl}`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "dangdang-emotion.jpg";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      /* cancelled */
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex gap-2 mt-3">
      <button
        onClick={handleKakao}
        className="flex-1 py-3 bg-[#FEE500] text-[#3C1E1E] rounded-2xl text-sm font-bold hover:-translate-y-1 hover:shadow-lg transition-all flex items-center justify-center gap-1.5"
      >
        💬 카카오톡
      </button>
      <button
        onClick={handleInstaSave}
        disabled={saving || !imageUrl}
        className="flex-1 py-3 bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white rounded-2xl text-sm font-bold hover:-translate-y-1 hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        📸 인스타
      </button>
      <button
        onClick={handleCopyLink}
        className="flex-1 py-3 bg-purple-100 text-purple-600 rounded-2xl text-sm font-bold hover:-translate-y-1 hover:shadow-lg transition-all flex items-center justify-center gap-1.5"
      >
        {copied ? "✅ 복사됨" : "🔗 링크"}
      </button>
    </div>
  );
}
