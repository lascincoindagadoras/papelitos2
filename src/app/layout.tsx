import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Papelitos - Tareas divertidas en familia",
  description: "Organiza las tareas del hogar de forma divertida para los niños",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-gray-50">{children}</body>
    </html>
  );
}
