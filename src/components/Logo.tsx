export default function Logo() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-28 h-28 bg-gradient-to-br from-indigo-500 to-amber-400 rounded-3xl flex items-center justify-center shadow-lg">
        <span className="text-5xl">📝</span>
      </div>
      <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-amber-500 bg-clip-text text-transparent">
        Papelitos
      </h1>
      <p className="text-sm text-gray-500">Tareas divertidas en familia</p>
    </div>
  );
}
