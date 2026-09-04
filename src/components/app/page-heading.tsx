export function PageHeading({ eyebrow, title, description, controls }: { eyebrow: string; title: string; description: string; controls?: React.ReactNode }) {
  return <section className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
    <div><p className="mb-2 text-xs font-medium text-primary">{eyebrow}</p><h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p></div>
    {controls ? <div className="shrink-0">{controls}</div> : null}
  </section>;
}
