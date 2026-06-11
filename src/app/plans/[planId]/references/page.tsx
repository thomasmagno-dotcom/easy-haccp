import { REFERENCES, REFERENCE_CATEGORIES } from "@/lib/references";

export default function ReferencesPage() {
  const grouped = REFERENCE_CATEGORIES
    .map((cat) => ({ cat, items: REFERENCES.filter((r) => r.category === cat) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-neutral-900">References</h2>
        <p className="text-sm text-neutral-500 mt-1">
          Regulatory, guidance, and scientific sources that underpin this HACCP plan — including
          the hazard database, prerequisite program structure, risk matrix, and CCP decision tree.
          This list is included in the PDF export.
        </p>
      </div>

      <div className="space-y-8">
        {grouped.map(({ cat, items }) => (
          <section key={cat}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-3 pb-2 border-b border-neutral-100">
              {cat}
            </h3>
            <div className="space-y-4">
              {items.map((ref) => (
                <div key={ref.id} className="flex gap-4">
                  {/* Citation badge */}
                  <div className="shrink-0 w-44">
                    <span className="text-xs font-mono font-semibold text-neutral-700 bg-neutral-100 px-2 py-1 rounded leading-snug block">
                      {ref.citation}
                    </span>
                    <span className="text-[11px] text-neutral-400 mt-1 block">{ref.year}</span>
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-neutral-900 leading-snug">
                      {ref.title}
                    </p>
                    <p className="text-xs text-neutral-500 mt-0.5">{ref.publisher}</p>
                    <p className="text-xs text-neutral-600 mt-1.5 leading-relaxed">
                      {ref.description}
                    </p>
                    {ref.url && (
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-blue-600 hover:underline mt-1 inline-block break-all"
                      >
                        {ref.url}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-10 text-[11px] text-neutral-400 border-t border-neutral-100 pt-4">
        This reference list reflects the standards and regulations applied at the time of plan
        preparation. Users are responsible for verifying that cited documents remain current and
        applicable to their jurisdiction and product category.
      </p>
    </div>
  );
}
