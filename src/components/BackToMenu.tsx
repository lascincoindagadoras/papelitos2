'use client';
import Link from 'next/link';

export default function BackToMenu() {
  return (
    <Link
      href="/menu"
      className="fixed bottom-6 left-6 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold py-2 px-3 text-sm rounded-lg shadow-md transition-colors z-50"
    >
      ←
    </Link>
  );
}
