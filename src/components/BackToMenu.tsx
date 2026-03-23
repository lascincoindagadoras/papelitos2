'use client';
import Link from 'next/link';

export default function BackToMenu() {
  return (
    <Link
      href="/menu"
      className="fixed bottom-6 left-6 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-xl shadow-md transition-colors z-50"
    >
      ← Volver a Menú
    </Link>
  );
}
