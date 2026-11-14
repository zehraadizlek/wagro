export default function PageHeader({
  title,
  description,
  eyebrow,
}: {
  title: React.ReactNode;
  description: string;
  eyebrow?: string;
}) {
  return (
    <header className="rise mb-10">
      {eyebrow && (
        <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3.5 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-muted">
          <span className="h-2 w-2 rounded-full bg-terracotta" />
          {eyebrow}
        </span>
      )}
      <h1 className="max-w-3xl font-display text-6xl leading-[0.95] tracking-tight text-espresso md:text-8xl">
        {title}
      </h1>
      <p className="mt-5 max-w-xl text-lg text-muted">{description}</p>
    </header>
  );
}