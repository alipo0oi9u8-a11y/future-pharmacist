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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
