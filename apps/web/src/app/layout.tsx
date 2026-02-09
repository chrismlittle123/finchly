import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Finchly",
  description: "Your team's link knowledge base",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
