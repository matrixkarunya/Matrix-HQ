export default function manifest() {
  return {
    name: "MATRIX HQ",
    short_name: "MATRIX HQ",
    description: "Official Board Management App",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#05070F", // splash background
    theme_color: "#05070F",      // status bar / title bar
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}