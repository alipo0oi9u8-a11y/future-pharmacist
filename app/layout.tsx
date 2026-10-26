import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Future Pharmacists | Pharm D Study Hub",
  description: "A shared study space for Pharm D Semester 1 notes, quizzes, and course resources.",
  applicationName: "Future Pharmacists",
  icons: {
    icon: "/assets/future-pharmacists-logo.jpeg",
    shortcut: "/assets/future-pharmacists-logo.jpeg",
    apple: "/assets/future-pharmacists-logo.jpeg",
  },
  appleWebApp: { capable: true, title: "Future Pharmacists", statusBarStyle: "black-translucent" },
};

const themeBootstrap = `try {
  const saved = localStorage.getItem("fp-theme-v1");
  if (saved === "dark" || saved === "light") document.documentElement.dataset.theme = saved;
} catch {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
