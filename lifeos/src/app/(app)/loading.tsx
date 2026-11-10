export default function Loading() {
  return (
    <div className="animate-fade space-y-6" aria-busy aria-label="Lädt …">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-white/[0.06]" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-white/[0.04]" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card h-28 animate-pulse" />
        ))}
      </div>
      <div className="card h-72 animate-pulse" />
    </div>
  );
}
