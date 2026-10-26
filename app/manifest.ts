import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Future Pharmacists",
    short_name: "Future Pharm",
    description: "A shared Pharm D study space for notes, quizzes, and course resources.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#06281F",
    theme_color: "#06281F",
    icons: [
      {
        src: "/assets/future-pharmacists-logo.jpeg",
        sizes: "any",
        type: "image/jpeg",
        purpose: "any",
      },
    ],
  };
}
