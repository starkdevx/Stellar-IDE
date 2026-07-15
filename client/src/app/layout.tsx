import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stellar Soroban Browser IDE",
  description: "An in-browser IDE for writing, compiling, deploying, and testing Soroban smart contracts on the Stellar network.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
