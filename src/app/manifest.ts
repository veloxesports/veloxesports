import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Khemora Esports",
    short_name: "Khemora",
    description: "A premium esports tournament platform on Telegram.",
    start_url: "/",
    display: "standalone",
    background_color: "#080d09",
    theme_color: "#080d09",
    icons: [
      {
        src: "/images/khemora-logo.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
