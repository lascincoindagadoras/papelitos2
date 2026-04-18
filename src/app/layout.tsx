import type { Metadata } from "next";
import "./globals.css";
import AutoImpresion from "@/components/AutoImpresion";

export const metadata: Metadata = {
  title: "CUCLA - Consigue Una Casa Limpia Ayudando",
  description: "Organiza las tareas del hogar de forma divertida para los niños",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-amber-50/30">
        <AutoImpresion />
        {children}
      </body>
    </html>
  );
}
