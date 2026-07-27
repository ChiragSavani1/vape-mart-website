import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const protocol = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    title: { default: "Vape Mart | Ontario Vape Catalogue", template: "%s | Vape Mart" },
    description: "Browse Vape Mart products and check in-store availability. Ontario adults 19+ only. No online sales, shipping, or delivery.",
    icons: { icon: "/brand/vape-mart-logo-black.png" },
    openGraph: { title: "Vape Mart", description: "Find your flavour. Check it in store.", images: [`${origin}/og-monochrome.png`] },
    twitter: { card: "summary_large_image", title: "Vape Mart", description: "Find your flavour. Check it in store.", images: [`${origin}/og-monochrome.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
