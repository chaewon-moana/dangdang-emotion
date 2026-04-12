import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "우리 강아지 감정은? 🐾",
  description: "사진 한 장으로 강아지 속마음을 읽어드려요",
  openGraph: {
    title: "우리 강아지 감정은? 🐾",
    description: "사진 한 장으로 강아지 속마음을 읽어드려요",
    siteName: "댕댕 감정연구소",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {children}
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
          integrity="sha384-DKYJZ8NLiK8MN4/C5P2ezmFnkrysYIcCY1LSB/CHKi3bFBHpLbC4FRx9LHTQBKO"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
