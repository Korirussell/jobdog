export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="border-2 border-black/10 bg-white px-6 py-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <p className="font-mono text-xs font-bold text-text-secondary">Booting JobDog...</p>
      </div>
    </div>
  );
}
