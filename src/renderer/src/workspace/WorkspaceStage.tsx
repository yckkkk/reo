export function WorkspaceStage() {
  return (
    <section
      aria-label="记忆空间舞台"
      className="flex w-full items-center justify-center text-center"
    >
      <div className="flex max-w-[520px] flex-col items-center">
        <h1 className="text-balance font-memory-serif text-heading font-light leading-heading tracking-heading text-obsidian xl:text-heading-lg xl:leading-heading-lg xl:tracking-heading-lg">
          今天想记录些什么？
        </h1>
        <p className="mt-12 text-body-lg leading-body-lg text-gravel">先把这一刻留下来。</p>
      </div>
    </section>
  );
}
