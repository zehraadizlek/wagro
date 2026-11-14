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
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-olive">
          {eyebrow}
        </p>
      )}
      <h1 className="max-w-3xl font-display text-4xl leading-tight text-espresso md:text-6xl">
        {title}
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted">{description}</p>
    </header>
  );
}