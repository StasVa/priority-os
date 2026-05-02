export function AuthLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center select-none">
      <div className="flex items-baseline gap-1.5 opacity-60">
        <span
          className="font-serif text-2xl font-semibold tracking-tight"
          style={{ fontVariationSettings: '"opsz" 144' }}
        >
          Priority
        </span>
        <span className="font-serif italic text-xl text-muted-foreground font-light">
          OS
        </span>
      </div>
    </div>
  );
}
