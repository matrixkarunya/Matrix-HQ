import { Inter, Space_Grotesk } from "next/font/google";
import MemberShell from "@/components/MemberShell";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space",
});

export default function MemberLayout({ children }) {
  return (
    <div className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <MemberShell>{children}</MemberShell>
    </div>
  );
}
