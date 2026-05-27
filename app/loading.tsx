export default function Loading() {
  return (
    <main className="min-h-screen bg-night px-4 py-6 text-bone">
      <div className="mx-auto max-w-7xl">
        <header className="flex h-20 items-center justify-between border-b border-white/10">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-neon/85">Cactus Club</p>
          </div>
          <div className="h-9 w-24 rounded-full bg-white/10" />
        </header>
        <section className="glass-panel mt-6 min-h-[58vh] rounded-[1.75rem] p-5">
          <div className="grid gap-4 md:grid-cols-[340px_1fr]">
            <div className="soft-shimmer h-[360px] rounded-[1.25rem] bg-white/10" />
            <div className="space-y-4">
              <div className="soft-shimmer h-8 w-44 rounded-full bg-white/10" />
              <div className="grid gap-3 sm:grid-cols-2">
                {[0, 1, 2, 3].map((item) => (
                  <div className="soft-shimmer h-40 rounded-[1.25rem] bg-white/8" key={item} />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
