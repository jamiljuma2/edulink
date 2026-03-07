import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EduLink Writers",
    short_name: "EduLink",
    description: "EduLink connects students with trusted academic writers.",
    start_url: "/",
    display: "standalone",
    background_color: "#ecfdf5",
    theme_color: "#065f46",
    orientation: "portrait",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
