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
    description: "Browse Vape Mart products and ask our Barrie store to confirm current in-store availability. Ontario adults 19+ only.",
    icons: { icon: "/brand/vape-mart-logo-black.png" },
    openGraph: { title: "Vape Mart | Barrie Vape Catalogue", description: "Browse the Vape Mart catalogue and ask our Barrie store to confirm availability.", images: [`${origin}/og-storefront-redesign.png`] },
    twitter: { card: "summary_large_image", title: "Vape Mart | Barrie Vape Catalogue", description: "Browse products and check in-store availability.", images: [`${origin}/og-storefront-redesign.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
