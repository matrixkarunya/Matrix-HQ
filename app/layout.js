import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import MeshDriftBackground from "@/components/MeshDriftBackground";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import AppSplash from "@/components/AppSplash";

export const metadata = {
  title: "Matrix HQ",
  description: "Official Matrix Board Management System",
  applicationName: "Matrix HQ",
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: {
    capable: true,
    title: "Matrix HQ",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  themeColor: "#05070F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#05070F] text-white antialiased">
        <ServiceWorkerRegistration />
        <AppSplash />
        <MeshDriftBackground dim={0.35} />

        <div className="relative z-10 min-h-screen">
          <AuthProvider>{children}</AuthProvider>
        </div>
      </body>
    </html>
  );
}