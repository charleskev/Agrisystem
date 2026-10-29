export default function StatCard({ label, value, tone = "green" }) {
  const tones = { green: "border-l-emerald-700", amber: "border-l-amber-600", red: "border-l-red-600", blue: "border-l-sky-700" };
  const icon = tone === "amber" || tone === "red"
    ? <><path d="m12 3 9 17H3L12 3Z"/><path d="M12 9v5M12 17h.01"/></>
    : tone === "blue"
      ? <><path d="M7 3h8l4 4v14H5V3h2Z"/><path d="M9 13h6M9 17h4M14 3v5h5"/></>
      : <><path d="M12 21V9"/><path d="M12 13c-5.5 0-8-2.8-8-7 5.4 0 8 2.2 8 7ZM12 17c0-4.2 2.6-7 8-7 0 4.2-2.5 7-8 7Z"/></>;
  return <div data-tone={tone} className={`stat-card rounded-md border border-slate-200 border-l-[3px] bg-white p-4 ${tones[tone] || tones.green}`}>
    <span className="stat-card-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icon}</svg></span>
    <span className="stat-card-copy"><p className="text-sm font-medium text-slate-600">{label}</p><p className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{value}</p></span>
  </div>;
}
