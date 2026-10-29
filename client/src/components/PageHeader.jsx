export default function PageHeader({ eyebrow, title, description, action, centered = false, className = "" }) {
  return <header className={`page-header flex flex-col gap-4 border-b pb-5 ${centered ? "w-full max-w-4xl items-center text-center" : "justify-between sm:flex-row sm:items-end"} ${className}`}>
    <div>
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-[.12em] text-emerald-800">{eyebrow}</p>}
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
      {description && <p className={`mt-2 max-w-3xl text-sm leading-6 text-slate-600 ${centered ? "mx-auto" : ""}`}>{description}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </header>;
}
