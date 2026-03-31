import Image from 'next/image';

export default function Logo() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-28 h-28 rounded-3xl overflow-hidden shadow-lg">
        <Image src="/logo-bee.jpeg" alt="CUCLA logo" width={112} height={112} className="w-full h-full object-cover" priority />
      </div>
      <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-500 to-yellow-500 bg-clip-text text-transparent">
        CUCLA
      </h1>
      <p className="text-sm text-stone-500">Tareas divertidas en familia</p>
    </div>
  );
}
