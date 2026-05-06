export function App() {
  return (
    <main className="grid min-h-screen place-items-center bg-eggshell px-24 py-64 text-obsidian sm:px-40">
      <section
        className="w-full rounded-cards border border-chalk bg-eggshell px-32 py-40 shadow-subtle sm:px-48 sm:py-56"
        aria-labelledby="app-title"
      >
        <div className="mb-24 flex items-center gap-12">
          <span className="size-12 rounded-full bg-signal-blue" aria-hidden="true" />
          <p className="font-waldenburgfh text-body font-bold uppercase leading-body text-gravel">
            Electron
          </p>
        </div>
        <h1
          id="app-title"
          className="font-waldenburg text-display font-light leading-display tracking-display text-obsidian"
        >
          Reo
        </h1>
        <p className="mt-24 text-body-lg leading-body-lg text-gravel">
          React + TypeScript + Vite + Electron.
        </p>
      </section>
    </main>
  );
}
