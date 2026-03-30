import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "우리 강아지 감정은? 🐾",
  description: "사진 한 장으로 강아지 속마음을 읽어드려요",
  openGraph: {
    title: "우리 강아지 감정은? 🐾",
    description: "사진 한 장으로 강아지 속마음을 읽어드려요",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
