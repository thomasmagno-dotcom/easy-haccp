import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const s = StyleSheet.create({
  page: { padding: 40, paddingBottom: 56, fontFamily: "Helvetica", fontSize: 9, color: "#1a1a1a" },
  coverPage: { padding: 60, fontFamily: "Helvetica", fontSize: 9, color: "#1a1a1a" },
  coverTitle: { fontSize: 26, fontFamily: "Helvetica-Bold", marginBottom: 8, textAlign: "center" },
  coverSubtitle: { fontSize: 15, color: "#444", marginBottom: 6, textAlign: "center" },
  coverDetail: { fontSize: 10, color: "#666", marginBottom: 3, textAlign: "center" },
  coverDivider: { borderBottomWidth: 1, borderBottomColor: "#ddd", marginVertical: 20 },
  h1: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 8, marginTop: 16, borderBottomWidth: 1, borderBottomColor: "#ccc", paddingBottom: 4 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 6, marginTop: 12, color: "#333" },
  h3: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4, marginTop: 8, color: "#555" },
  para: { marginBottom: 4, lineHeight: 1.4 },
  table: { borderWidth: 1, borderColor: "#ddd" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#ddd" },
  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#999", backgroundColor: "#f5f5f5" },
  th: { padding: 4, fontFamily: "Helvetica-Bold", fontSize: 8 },
  td: { padding: 4, fontSize: 8 },
  fieldRow: { flexDirection: "row", marginBottom: 4 },
  fieldLabel: { width: 130, fontFamily: "Helvetica-Bold", fontSize: 8, color: "#555" },
  fieldValue: { flex: 1, fontSize: 8 },
  badge: { backgroundColor: "#dc2626", color: "#fff", paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2, fontSize: 7, fontFamily: "Helvetica-Bold" },
  stepBox: { borderRadius: 6, borderWidth: 1, padding: 8, marginBottom: 0 },
  stepBoxInner: { flexDirection: "row", alignItems: "flex-start" },
  stepNum: { width: 22, height: 22, borderRadius: 11, justifyContent: "center", alignItems: "center", marginRight: 8, flexShrink: 0 },
  stepNumText: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  stepArrow: { alignItems: "center", height: 14, justifyContent: "center" },
  stepArrowLine: { width: 1, height: 8, backgroundColor: "#9ca3af" },
  stepArrowHead: { width: 6, height: 6, borderBottomWidth: 1, borderRightWidth: 1, borderColor: "#9ca3af", transform: "rotate(45deg)", marginTop: -1 },
  sigSection: { marginTop: 32 },
  sigTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 16, color: "#333", borderBottomWidth: 1, borderBottomColor: "#ccc", paddingBottom: 4 },
  sigRow: { flexDirection: "row", gap: 24, marginBottom: 20 },
  sigBlock: { flex: 1 },
  sigLabel: { fontSize: 8, color: "#555", marginBottom: 20 },
  sigLine: { borderBottomWidth: 1, borderBottomColor: "#333", marginBottom: 4 },
  sigLineLabel: { fontSize: 7, color: "#888" },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, height: 40, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingHorizontal: 40, paddingTop: 8, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", backgroundColor: "#fff" },
  footerLeft: { flex: 1, fontSize: 7, color: "#6b7280" },
  footerCenter: { flex: 2, fontSize: 7, color: "#6b7280", textAlign: "center" },
  footerRight: { flex: 1, fontSize: 7, color: "#6b7280", textAlign: "right" },
});

function fmtDateTime(iso: string): string {
  if (!iso) return "";
  const n = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(iso) ? iso.replace(" ", "T") + "Z" : iso;
  return new Date(n).toLocaleString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  const n = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(iso) ? iso.replace(" ", "T") + "Z" : iso;
  return new Date(n).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function PageFooter({ planName, versionNumber, snapshotAt, publishedBy }: {
  planName: string; versionNumber: number; snapshotAt: string; publishedBy: string | null;
}) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerLeft}>{planName}</Text>
      <Text style={s.footerCenter}>
        v{versionNumber}  |  {fmtDateTime(snapshotAt)}{publishedBy ? `  |  ${publishedBy}` : ""}
      </Text>
      <Text style={s.footerRight} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

// ── Decision tree helpers ──────────────────────────────────────────────────────

const DT_QUESTIONS = [
  "Q1: Controlled by GHPs/PRPs?",
  "Q2: Specific control measures exist here?",
  "Q3: Subsequent step controls it?",
  "Q4: This step can control it?",
];

const DT_RESULT_LABELS: Record<string, string> = {
  ccp:     "CCP",
  not_ccp: "Not CCP",
  prp:     "GHP / PRP",
  modify:  "Modify Process",
};

const DT_RESULT_COLORS: Record<string, { bg: string; text: string }> = {
  ccp:     { bg: "#fee2e2", text: "#dc2626" },
  not_ccp: { bg: "#f3f4f6", text: "#374151" },
  prp:     { bg: "#dcfce7", text: "#15803d" },
  modify:  { bg: "#fff7ed", text: "#c2410c" },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DecisionTreeBlock({ hazardName, dtJson }: { hazardName: string; dtJson: string | null }) {
  let dt: Record<string, boolean | string | null> = { q1: null, q2: null, q3: null, q4: null, result: null };
  try { if (dtJson) dt = JSON.parse(dtJson); } catch {}

  const answers = [dt.q1, dt.q2, dt.q3, dt.q4];
  const result = (dt.result as string | null) ?? null;
  const resultStyle = result ? DT_RESULT_COLORS[result] ?? { bg: "#f3f4f6", text: "#374151" } : null;

  // Only show answered questions
  const answeredCount = answers.filter((a) => a !== null && a !== undefined).length;
  if (answeredCount === 0) return null;

  return (
    <View style={{ marginBottom: 6, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
      <View style={{ backgroundColor: "#fafafa", paddingHorizontal: 6, paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }}>
        <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#374151" }}>
          Decision Tree — Codex CXC 1-1969 Rev. 2020: {hazardName}
        </Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 6, paddingVertical: 4, gap: 4 }}>
        {DT_QUESTIONS.map((q, i) => {
          const ans = answers[i];
          if (ans === null || ans === undefined) return null;
          return (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", marginRight: 10, marginBottom: 2 }}>
              <Text style={{ fontSize: 7, color: "#6b7280", marginRight: 3 }}>{q}</Text>
              <View style={{
                backgroundColor: ans === true ? "#dcfce7" : "#f3f4f6",
                borderRadius: 2, paddingHorizontal: 4, paddingVertical: 1,
              }}>
                <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: ans === true ? "#15803d" : "#374151" }}>
                  {ans === true ? "Yes" : "No"}
                </Text>
              </View>
            </View>
          );
        })}
        {result && resultStyle && (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ fontSize: 7, color: "#6b7280", marginRight: 3 }}>Result:</Text>
            <View style={{ backgroundColor: resultStyle.bg, borderRadius: 2, paddingHorizontal: 5, paddingVertical: 1 }}>
              <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: resultStyle.text }}>
                {DT_RESULT_LABELS[result] ?? result}
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Output type config ────────────────────────────────────────────────────────

const OUTPUT_TYPE_LABELS: Record<string, string> = {
  primary_product:  "Primary Product",
  waste:            "Waste",
  rejected_product: "Rejected",
  water_discharge:  "Water Discharge",
  other:            "Other",
};

const OUTPUT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  primary_product:  { bg: "#ccfbf1", text: "#0f766e", border: "#99f6e4" },
  waste:            { bg: "#f3f4f6", text: "#374151", border: "#d1d5db" },
  rejected_product: { bg: "#fee2e2", text: "#dc2626", border: "#fca5a5" },
  water_discharge:  { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  other:            { bg: "#f5f3ff", text: "#7c3aed", border: "#c4b5fd" },
};

// ── Hazard type badge config (PDF) ────────────────────────────────────────────

const HAZARD_TYPE_PDF: Record<string, { letter: string; bg: string; text: string }> = {
  biological:   { letter: "B", bg: "#fee2e2", text: "#b91c1c" },
  chemical:     { letter: "C", bg: "#ffedd5", text: "#c2410c" },
  physical:     { letter: "P", bg: "#dbeafe", text: "#1d4ed8" },
  allergen:     { letter: "A", bg: "#f5f3ff", text: "#7c3aed" },
  radiological: { letter: "R", bg: "#fef9c3", text: "#a16207" },
  fraud:        { letter: "F", bg: "#f3f4f6", text: "#374151" },
};

const HAZARD_TYPE_PDF_ORDER = ["biological", "chemical", "physical", "allergen", "radiological", "fraud"];

function PdfHazardTypeBadges({ types }: { types: string[] }) {
  const ordered = HAZARD_TYPE_PDF_ORDER.filter((t) => types.includes(t));
  if (ordered.length === 0) return null;
  return (
    <View style={{ flexDirection: "row", gap: 2, flexWrap: "wrap" }}>
      {ordered.map((type) => {
        const cfg = HAZARD_TYPE_PDF[type];
        if (!cfg) return null;
        return (
          <View key={type} style={{ backgroundColor: cfg.bg, borderRadius: 2, width: 14, height: 14, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: cfg.text }}>{cfg.letter}</Text>
          </View>
        );
      })}
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PdfHaccpPlan({ snapshot }: { snapshot: any }) {
  const plan = snapshot.plan;
  const steps = snapshot.processSteps || [];
  const ingredientsList = snapshot.ingredients || [];
  const snapshotAt: string = snapshot.snapshotAt || new Date().toISOString();
  const publishedBy: string | null = snapshot.publishedBy ?? null;
  const changeDescription: string | null = snapshot.changeDescription ?? null;
  const versionNumber: number = snapshot.versionNumber ?? plan.currentVersion ?? 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allVersions: any[] = snapshot.allVersions || [];

  let productDesc: Record<string, string> = {};
  try { productDesc = JSON.parse(plan.productDescription || "{}"); } catch {}
  let teamMembers: Array<Record<string, string>> = [];
  try { teamMembers = JSON.parse(plan.teamMembers || "[]"); } catch {}

  const footerProps = { planName: plan.name, versionNumber, snapshotAt, publishedBy };

  return (
    <Document>

      {/* ── Cover Page ──────────────────────────────────────────────────────── */}
      <Page size="LETTER" style={s.coverPage}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={s.coverTitle}>HACCP Plan</Text>
          <Text style={s.coverSubtitle}>{plan.name}</Text>
          <View style={{ ...s.coverDivider, width: 260 }} />
          <Text style={s.coverDetail}>{plan.facilityName}</Text>
          {plan.facilityAddress && <Text style={s.coverDetail}>{plan.facilityAddress}</Text>}
          <View style={{ marginTop: 16, alignItems: "center" }}>
            <Text style={{ ...s.coverDetail, fontSize: 11, fontFamily: "Helvetica-Bold", color: "#333" }}>Version {versionNumber}</Text>
            <Text style={{ ...s.coverDetail, marginTop: 4 }}>{fmtDate(snapshotAt)}</Text>
            {publishedBy && <Text style={{ ...s.coverDetail, marginTop: 2 }}>Published by: {publishedBy}</Text>}
            {changeDescription && <Text style={{ ...s.coverDetail, marginTop: 2, fontStyle: "italic" }}>&ldquo;{changeDescription}&rdquo;</Text>}
          </View>
          <Text style={{ ...s.coverDetail, marginTop: 28, fontSize: 8, color: "#aaa" }}>Compliant with CFIA FSEP, SFCR, and SQF standards</Text>
        </View>

        <View style={s.sigSection}>
          <Text style={s.sigTitle}>Authorisation</Text>
          <View style={s.sigRow}>
            {["Prepared by", "Approved by", "Next Review"].map((label) => (
              <View key={label} style={s.sigBlock}>
                <Text style={s.sigLabel}>{label}</Text>
                {[label === "Next Review" ? "Scheduled Review Date" : "Signature", "Print Name", "Title / Role", "Date"].map((lineLabel) => (
                  <View key={lineLabel} style={{ marginBottom: 14 }}>
                    <View style={s.sigLine} />
                    <Text style={s.sigLineLabel}>{lineLabel}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>

        <View style={{ ...s.footer, borderTopColor: "#e5e7eb" }} fixed>
          <Text style={s.footerLeft}>{plan.name}</Text>
          <Text style={s.footerCenter}>v{versionNumber}  |  {fmtDateTime(snapshotAt)}{publishedBy ? `  |  ${publishedBy}` : ""}</Text>
          <Text style={s.footerRight}>HACCP Plan</Text>
        </View>
      </Page>

      {/* ── Document Control ────────────────────────────────────────────────── */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.h1}>Document Control — Amendment Logbook</Text>
        {allVersions.length === 0 ? (
          <Text style={{ ...s.para, color: "#6b7280", fontStyle: "italic" }}>No published versions yet. This reflects the current working draft.</Text>
        ) : (
          <>
            <Text style={s.h2}>Version History</Text>
            <View style={{ ...s.table, marginBottom: 16 }}>
              <View style={s.tableHeaderRow}>
                <Text style={{ ...s.th, width: 52 }}>Version</Text>
                <Text style={{ ...s.th, width: 118 }}>Date &amp; Time</Text>
                <Text style={{ ...s.th, width: 110 }}>Published By</Text>
                <Text style={{ ...s.th, flex: 1 }}>Notes</Text>
                <Text style={{ ...s.th, width: 40, textAlign: "center" }}>Changes</Text>
              </View>
              {allVersions.map((v: any, i: number) => (
                <View key={i} style={{ ...s.tableRow, backgroundColor: i === 0 ? "#f0fdf4" : "transparent" }}>
                  <Text style={{ ...s.td, width: 52, fontFamily: "Helvetica-Bold" }}>v{v.versionNumber}{i === 0 ? " ★" : ""}</Text>
                  <Text style={{ ...s.td, width: 118 }}>{fmtDateTime(v.publishedAt)}</Text>
                  <Text style={{ ...s.td, width: 110 }}>{v.publishedBy || "—"}</Text>
                  <Text style={{ ...s.td, flex: 1 }}>{v.changeDescription || "—"}</Text>
                  <Text style={{ ...s.td, width: 40, textAlign: "center" }}>{(v.changeLog?.length ?? 0) > 0 ? String(v.changeLog.length) : "—"}</Text>
                </View>
              ))}
            </View>
            {allVersions.map((v: any, vi: number) => {
              const log: any[] = v.changeLog || [];
              if (log.length === 0) return null;
              const grouped: Record<string, string[]> = {};
              for (const e of log) { const s2 = e.section || "other"; if (!grouped[s2]) grouped[s2] = []; grouped[s2].push(e.text); }
              const sectionLabels: Record<string, string> = { plan: "Plan & Product", team: "HACCP Team", steps: "Process Steps", ingredients: "Ingredients" };
              return (
                <View key={vi} style={{ marginBottom: 8, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 4 }} wrap={false}>
                  <View style={{ flexDirection: "row", backgroundColor: vi === 0 ? "#f0fdf4" : "#f9fafb", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", width: 52 }}>v{v.versionNumber}</Text>
                    <Text style={{ fontSize: 7, color: "#6b7280", width: 120 }}>{fmtDateTime(v.publishedAt)}</Text>
                    <Text style={{ fontSize: 7, color: "#374151", flex: 1 }}>{v.changeDescription || ""}</Text>
                  </View>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
                    {Object.entries(grouped).map(([sec, items], si) => (
                      <View key={si} style={{ marginBottom: 4 }}>
                        <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: "#374151", marginBottom: 2 }}>{sectionLabels[sec] || sec}</Text>
                        {(items as string[]).map((text, k) => (
                          <View key={k} style={{ flexDirection: "row", marginBottom: 1, paddingLeft: 6 }}>
                            <Text style={{ fontSize: 7, color: "#374151", width: 8 }}>•</Text>
                            <Text style={{ fontSize: 7, color: "#374151", flex: 1, lineHeight: 1.4 }}>{text}</Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </>
        )}
        <PageFooter {...footerProps} />
      </Page>

      {/* ── Form 1: Product Description ────────────────────────────────────── */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.h1}>Form 1: Product Description</Text>
        {Object.entries({
          "Product Name": productDesc.name,
          "Characteristics": productDesc.characteristics,
          "Intended Use": productDesc.intendedUse,
          "Target Consumer": productDesc.targetConsumer,
          "Shelf Life": productDesc.shelfLife,
          "Packaging": productDesc.packaging,
          "Storage & Distribution": productDesc.storageDistribution,
          "Labelling": productDesc.labellingInstructions,
          "Regulatory Classification": productDesc.regulatoryClassification,
        }).map(([label, value]) => (
          <View key={label} style={s.fieldRow}>
            <Text style={s.fieldLabel}>{label}:</Text>
            <Text style={s.fieldValue}>{value || "—"}</Text>
          </View>
        ))}
        <PageFooter {...footerProps} />
      </Page>

      {/* ── Form 2: Ingredients ─────────────────────────────────────────────── */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.h1}>Form 2: Ingredients &amp; Incoming Materials</Text>
        {ingredientsList.length === 0 ? (
          <Text style={s.para}>No ingredients recorded.</Text>
        ) : (
          ingredientsList.map((ing: Record<string, any>, i: number) => {
            const ingHazards = (ing.hazards as any[]) || [];
            const sigHazards = ingHazards.filter((h: any) => h.isSignificant);
            return (
              <View key={i} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#f5f5f5", borderRadius: 4, padding: 6, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 2 }}>
                  <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, flex: 1 }}>{ing.name as string}</Text>
                  {ing.category && <Text style={{ fontSize: 7, color: "#6b7280", marginRight: 8 }}>{(ing.category as string).replace(/-/g, " ")}</Text>}
                  {ing.supplier && <Text style={{ fontSize: 7, color: "#9ca3af" }}>Supplier: {ing.supplier as string}</Text>}
                </View>
                {ingHazards.length === 0 ? (
                  <Text style={{ fontSize: 7, color: "#9ca3af", marginLeft: 4, fontStyle: "italic" }}>No hazards assigned.</Text>
                ) : (
                  ingHazards.map((ih: Record<string, any>, j: number) => {
                    const hazard = ih.hazard as Record<string, any>;
                    const sev = (ih.severityOverride || hazard.severity || "") as string;
                    const lik = (ih.likelihoodOverride || hazard.likelihood || "") as string;
                    const score = (parseInt(sev) || 0) * (parseInt(lik) || 0);
                    const cms = (ih.controlMeasures as any[]) || [];
                    return (
                      <View key={j} style={{ marginLeft: 4, marginBottom: 4, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 3 }}>
                        <View style={{ ...s.tableRow, backgroundColor: "#f9fafb", borderBottomWidth: cms.length > 0 ? 1 : 0 }}>
                          <Text style={{ ...s.td, width: 20 }}>{((hazard.type as string) || "").charAt(0).toUpperCase()}</Text>
                          <Text style={{ ...s.td, flex: 1, fontFamily: "Helvetica-Bold" }}>{hazard.name as string}</Text>
                          <Text style={{ ...s.td, width: 32 }}>S:{sev || "—"}</Text>
                          <Text style={{ ...s.td, width: 32 }}>L:{lik || "—"}</Text>
                          <Text style={{ ...s.td, width: 30 }}>R:{score > 0 ? score : "—"}</Text>
                          <Text style={{ ...s.td, width: 28 }}>{ih.isSignificant ? "⚠ Sig" : "OK"}</Text>
                          <Text style={{ ...s.td, flex: 1, color: "#6b7280" }}>{(ih.justification || "—") as string}</Text>
                        </View>
                        {cms.length > 0 && (
                          <View style={{ paddingHorizontal: 6, paddingVertical: 3 }}>
                            {cms.map((cm: Record<string, any>, k: number) => (
                              <Text key={k} style={{ fontSize: 7, color: "#374151", marginBottom: 1 }}>
                                • [{((cm.type as string) || "preventive")}] {cm.description as string}
                              </Text>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
                {sigHazards.length > 0 && (
                  <Text style={{ fontSize: 7, color: "#dc2626", marginLeft: 4, marginTop: 2 }}>
                    ⚠ {sigHazards.length} significant hazard{sigHazards.length > 1 ? "s" : ""} identified
                  </Text>
                )}
              </View>
            );
          })
        )}
        <PageFooter {...footerProps} />
      </Page>

      {/* ── Form 3: Process Flow Diagram ────────────────────────────────────── */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.h1}>Form 3: Process Flow Diagram</Text>

        {steps.map((step: Record<string, any>, i: number) => {
          const isCcp = !!step.isCcp;
          const stepType = (step.category as string) || "";
          const stepHazardList = (step.hazards as any[]) || [];
          const hazardCount = stepHazardList.length;
          const stepHazardTypes = Array.from(new Set(stepHazardList.map((sh: any) => (sh.hazard as any)?.type as string).filter(Boolean)));
          const stepInputsList = (step.inputs as any[]) || [];
          const stepOutputsList = (step.outputs as any[]) || [];

          let bgColor = "#fefce8", borderColor = "#fde047";
          let numBg = "#e5e7eb", numTextColor = "#1a1a1a";
          if (isCcp) { bgColor = "#fee2e2"; borderColor = "#fca5a5"; numBg = "#dc2626"; numTextColor = "#ffffff"; }
          else if (stepType === "receiving") { bgColor = "#dbeafe"; borderColor = "#93c5fd"; }
          else if (stepType === "storage") { bgColor = "#cffafe"; borderColor = "#67e8f9"; }

          const INPUT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
            water:    { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
            chemical: { bg: "#ffedd5", text: "#c2410c", border: "#fdba74" },
            material: { bg: "#dcfce7", text: "#15803d", border: "#86efac" },
            energy:   { bg: "#fef9c3", text: "#a16207", border: "#fde047" },
            other:    { bg: "#f3f4f6", text: "#374151", border: "#d1d5db" },
          };

          return (
            <View key={i}>
              <View style={{ ...s.stepBox, backgroundColor: bgColor, borderColor }}>
                <View style={s.stepBoxInner}>
                  {/* Step number circle */}
                  <View style={{ ...s.stepNum, backgroundColor: numBg }}>
                    <Text style={{ ...s.stepNumText, color: numTextColor }}>{step.stepNumber as number}</Text>
                  </View>

                  {/* Step content */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                      <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", marginRight: 4 }}>{step.name as string}</Text>
                      {isCcp && <View style={{ ...s.badge, marginRight: 4 }}><Text>{step.ccpNumber as string}</Text></View>}
                      {isCcp && <Text style={{ fontSize: 8, color: "#dc2626" }}>Critical Control Point</Text>}
                    </View>
                    {stepType !== "" && (
                      <Text style={{ fontSize: 7, color: "#6b7280", marginTop: 1 }}>
                        {stepType.charAt(0).toUpperCase() + stepType.slice(1)}
                      </Text>
                    )}
                    {step.description && (
                      <Text style={{ fontSize: 7, color: "#555", marginTop: 2 }}>
                        {(step.description as string).length > 80 ? (step.description as string).substring(0, 80) + "…" : step.description as string}
                      </Text>
                    )}

                    {/* Inputs row */}
                    {stepInputsList.length > 0 && (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 4, alignItems: "center" }}>
                        <Text style={{ fontSize: 7, color: "#6b7280", marginRight: 3 }}>↓ Inputs:</Text>
                        {stepInputsList.map((inp: any, k: number) => {
                          const col = INPUT_COLORS[(inp.type as string) || "other"] || INPUT_COLORS.other;
                          return (
                            <View key={k} style={{ backgroundColor: col.bg, borderWidth: 1, borderColor: col.border, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1, marginRight: 3, marginBottom: 2 }}>
                              <Text style={{ fontSize: 7, color: col.text, fontFamily: "Helvetica-Bold" }}>{inp.name as string}</Text>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {/* Outputs row */}
                    {stepOutputsList.length > 0 && (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 3, alignItems: "center" }}>
                        <Text style={{ fontSize: 7, color: "#6b7280", marginRight: 3 }}>→ Outputs:</Text>
                        {stepOutputsList.map((out: any, k: number) => {
                          const outType = (out.outputType as string) || "other";
                          const col = OUTPUT_COLORS[outType] || OUTPUT_COLORS.other;
                          const label = OUTPUT_TYPE_LABELS[outType] || outType;
                          const outHazardTypes: string[] = (out.hazardTypes as string[]) || [];
                          return (
                            <View key={k} style={{ backgroundColor: col.bg, borderWidth: 1, borderColor: col.border, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 2, marginRight: 3, marginBottom: 2 }}>
                              <Text style={{ fontSize: 7, color: col.text, fontFamily: "Helvetica-Bold" }}>
                                {out.name as string}
                                <Text style={{ fontFamily: "Helvetica", color: col.text }}> ({label})</Text>
                                {out.isCcp ? " ⚠ CCP" : ""}
                              </Text>
                              {outHazardTypes.length > 0 && (
                                <View style={{ marginTop: 2 }}>
                                  <PdfHazardTypeBadges types={outHazardTypes} />
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  {hazardCount > 0 && (
                    <View style={{ marginLeft: 6, flexShrink: 0, alignItems: "flex-end", gap: 3 }}>
                      <View style={{ backgroundColor: "#f3f4f6", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 7, color: "#374151" }}>{hazardCount} hazard{hazardCount > 1 ? "s" : ""}</Text>
                      </View>
                      <PdfHazardTypeBadges types={stepHazardTypes} />
                    </View>
                  )}
                </View>
              </View>

              {i < steps.length - 1 && (
                <View style={s.stepArrow}>
                  <View style={s.stepArrowLine} />
                  <View style={s.stepArrowHead} />
                </View>
              )}
            </View>
          );
        })}
        <PageFooter {...footerProps} />
      </Page>

      {/* ── Hazard Analysis per Step ─────────────────────────────────────────── */}
      {steps.map((step: Record<string, any>, i: number) => {
        const stepHazardList = (step.hazards as any[]) || [];
        if (stepHazardList.length === 0) return null;

        const significantHazards = stepHazardList.filter((sh: any) => sh.isSignificant);

        return (
          <Page key={i} size="LETTER" style={s.page}>
            <Text style={s.h1}>
              Step {step.stepNumber as number}: {step.name as string}
              {step.isCcp ? ` (${step.ccpNumber})` : ""}
            </Text>
            {step.description && <Text style={s.para}>{step.description as string}</Text>}

            {/* ── Hazard Identification Table ── */}
            <Text style={s.h2}>Hazard Identification &amp; Risk Assessment</Text>
            <View style={s.table}>
              <View style={s.tableHeaderRow}>
                <Text style={{ ...s.th, width: 22 }}>Type</Text>
                <Text style={{ ...s.th, width: 120 }}>Hazard</Text>
                <Text style={{ ...s.th, width: 35 }}>Sev.</Text>
                <Text style={{ ...s.th, width: 35 }}>Like.</Text>
                <Text style={{ ...s.th, width: 28 }}>Risk</Text>
                <Text style={{ ...s.th, width: 28 }}>Sig?</Text>
                <Text style={{ ...s.th, flex: 1 }}>Justification</Text>
              </View>
              {stepHazardList.map((sh: Record<string, any>, j: number) => {
                const hazard = sh.hazard as Record<string, any>;
                const sev = (sh.severityOverride || hazard.severity || "") as string;
                const lik = (sh.likelihoodOverride || hazard.likelihood || "") as string;
                const score = (parseInt(sev) || 0) * (parseInt(lik) || 0);
                const isSignificant = !!sh.isSignificant;
                return (
                  <View key={j} style={{ ...s.tableRow, backgroundColor: isSignificant ? "#fff7ed" : "transparent" }}>
                    <Text style={{ ...s.td, width: 22 }}>{((hazard.type as string) || "").charAt(0).toUpperCase()}</Text>
                    <Text style={{ ...s.td, width: 120, fontFamily: isSignificant ? "Helvetica-Bold" : "Helvetica" }}>{hazard.name as string}</Text>
                    <Text style={{ ...s.td, width: 35 }}>{sev || "—"}</Text>
                    <Text style={{ ...s.td, width: 35 }}>{lik || "—"}</Text>
                    <Text style={{ ...s.td, width: 28 }}>{score > 0 ? String(score) : "—"}</Text>
                    <Text style={{ ...s.td, width: 28, color: isSignificant ? "#c2410c" : "#374151" }}>
                      {isSignificant ? "⚠ Yes" : "No"}
                    </Text>
                    <Text style={{ ...s.td, flex: 1 }}>{(sh.justification || "—") as string}</Text>
                  </View>
                );
              })}
            </View>

            {/* ── Control Measures ── */}
            {stepHazardList.some((sh: any) => ((sh.controlMeasures as any[]) || []).length > 0) && (
              <>
                <Text style={s.h2}>Control Measures</Text>
                {stepHazardList
                  .filter((sh: any) => ((sh.controlMeasures as any[]) || []).length > 0)
                  .map((sh: Record<string, any>, j: number) => {
                    const hazard = sh.hazard as Record<string, any>;
                    const cms = (sh.controlMeasures as any[]) || [];
                    return (
                      <View key={j} style={{ marginBottom: 6, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
                        <View style={{ backgroundColor: "#f9fafb", paddingHorizontal: 6, paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }}>
                          <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: "#374151" }}>
                            {((hazard.type as string) || "").charAt(0).toUpperCase()} — {hazard.name as string}
                            {sh.isSignificant ? "  ⚠ Significant" : ""}
                          </Text>
                        </View>
                        <View style={{ paddingHorizontal: 6, paddingVertical: 4 }}>
                          {cms.map((cm: Record<string, any>, k: number) => (
                            <View key={k} style={{ flexDirection: "row", marginBottom: 2 }}>
                              <View style={{ backgroundColor: "#e0f2fe", borderRadius: 2, paddingHorizontal: 4, paddingVertical: 1, marginRight: 6, flexShrink: 0, alignSelf: "flex-start" }}>
                                <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: "#0369a1" }}>
                                  {((cm.type as string) || "preventive").replace(/_/g, " ")}
                                </Text>
                              </View>
                              <Text style={{ fontSize: 8, color: "#111827", flex: 1, lineHeight: 1.3 }}>{cm.description as string}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    );
                  })}
              </>
            )}

            {/* ── Decision Tree (significant hazards only) ── */}
            {significantHazards.length > 0 && (
              <>
                <Text style={s.h2}>CCP Decision Tree — Codex CXC 1-1969 Rev. 2020</Text>
                <View style={{ marginBottom: 6, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {["Q1: Controlled by GHPs/PRPs?", "Q2: Control measures exist here?", "Q3: Subsequent step controls it?", "Q4: This step can control it?"].map((q, qi) => (
                    <Text key={qi} style={{ fontSize: 7, color: "#6b7280" }}>{q}</Text>
                  ))}
                </View>
                {significantHazards.map((sh: Record<string, any>, j: number) => (
                  <DecisionTreeBlock
                    key={j}
                    hazardName={(sh.hazard as Record<string, any>).name as string}
                    dtJson={(sh.decisionTreeAnswers as string | null) ?? null}
                  />
                ))}
              </>
            )}

            {/* ── Linked PRPs ── */}
            {stepHazardList.some((sh: any) => ((sh.linkedPrps as any[]) || []).length > 0) && (
              <>
                <Text style={s.h2}>Linked Prerequisite Programs (PRPs)</Text>
                <View style={s.table}>
                  <View style={s.tableHeaderRow}>
                    <Text style={{ ...s.th, width: 50 }}>FSEP Code</Text>
                    <Text style={{ ...s.th, width: 140 }}>Hazard</Text>
                    <Text style={{ ...s.th, flex: 1 }}>PRP Program</Text>
                    <Text style={{ ...s.th, width: 60 }}>Reference</Text>
                    <Text style={{ ...s.th, width: 60 }}>Owner</Text>
                  </View>
                  {stepHazardList
                    .filter((sh: any) => ((sh.linkedPrps as any[]) || []).length > 0)
                    .flatMap((sh: Record<string, any>) =>
                      ((sh.linkedPrps as any[]) || []).map((prp: Record<string, any>, k: number) => ({
                        hazardName: (sh.hazard as Record<string, any>).name as string,
                        prp,
                        key: `${(sh.hazard as any).id}-${k}`,
                      })),
                    )
                    .map(({ hazardName, prp, key }: { hazardName: string; prp: Record<string, any>; key: string }) => (
                      <View key={key} style={s.tableRow}>
                        <Text style={{ ...s.td, width: 50, fontFamily: "Helvetica-Bold", color: "#374151" }}>{(prp.fsepCode || prp.prpType) as string}</Text>
                        <Text style={{ ...s.td, width: 140 }}>{hazardName}</Text>
                        <Text style={{ ...s.td, flex: 1 }}>{prp.programName as string}</Text>
                        <Text style={{ ...s.td, width: 60 }}>{(prp.documentReference || "—") as string}</Text>
                        <Text style={{ ...s.td, width: 60 }}>{(prp.owner || "—") as string}</Text>
                      </View>
                    ))}
                </View>
              </>
            )}

            {/* ── CCP Details ── */}
            {step.ccp && (() => {
              const ccp = step.ccp as Record<string, any>;
              const limits = (ccp.criticalLimits as any[]) || [];
              const monitoring = (ccp.monitoringProcedures as any[]) || [];
              const corrective = (ccp.correctiveActions as any[]) || [];
              const verification = (ccp.verificationProcedures as any[]) || [];
              return (
                <View>
                  <Text style={s.h2}>CCP Details — {step.ccpNumber as string}</Text>
                  <View style={s.fieldRow}><Text style={s.fieldLabel}>Hazard(s) Controlled:</Text><Text style={s.fieldValue}>{ccp.hazardDescription as string}</Text></View>
                  <View style={s.fieldRow}><Text style={s.fieldLabel}>Control Measure:</Text><Text style={s.fieldValue}>{ccp.controlMeasureDescription as string}</Text></View>
                  {limits.length > 0 && (
                    <>
                      <Text style={s.h3}>Critical Limits</Text>
                      <View style={s.table}>
                        <View style={s.tableHeaderRow}>
                          {["Parameter", "Min", "Max", "Target", "Unit", "Scientific Basis"].map((h) => (
                            <Text key={h} style={{ ...s.th, flex: 1 }}>{h}</Text>
                          ))}
                        </View>
                        {limits.map((l: Record<string, any>, k: number) => (
                          <View key={k} style={s.tableRow}>
                            <Text style={{ ...s.td, flex: 1 }}>{l.parameter as string}</Text>
                            <Text style={{ ...s.td, flex: 1 }}>{(l.minimum || "—") as string}</Text>
                            <Text style={{ ...s.td, flex: 1 }}>{(l.maximum || "—") as string}</Text>
                            <Text style={{ ...s.td, flex: 1 }}>{(l.target || "—") as string}</Text>
                            <Text style={{ ...s.td, flex: 1 }}>{(l.unit || "—") as string}</Text>
                            <Text style={{ ...s.td, flex: 1 }}>{(l.scientificBasis || "—") as string}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                  {monitoring.length > 0 && (
                    <>
                      <Text style={s.h3}>Monitoring Procedures</Text>
                      <View style={s.table}>
                        <View style={s.tableHeaderRow}>
                          {["What", "How", "Frequency", "Who", "Record Form"].map((h) => (
                            <Text key={h} style={{ ...s.th, flex: 1 }}>{h}</Text>
                          ))}
                        </View>
                        {monitoring.map((m: Record<string, any>, k: number) => (
                          <View key={k} style={s.tableRow}>
                            <Text style={{ ...s.td, flex: 1 }}>{m.what as string}</Text>
                            <Text style={{ ...s.td, flex: 1 }}>{m.how as string}</Text>
                            <Text style={{ ...s.td, flex: 1 }}>{m.frequency as string}</Text>
                            <Text style={{ ...s.td, flex: 1 }}>{m.who as string}</Text>
                            <Text style={{ ...s.td, flex: 1 }}>{(m.recordForm || "—") as string}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                  {corrective.length > 0 && (
                    <>
                      <Text style={s.h3}>Corrective Actions</Text>
                      {corrective.map((c: Record<string, any>, k: number) => (
                        <View key={k} style={{ marginBottom: 4, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 3, padding: 5 }}>
                          <View style={s.fieldRow}><Text style={{ ...s.fieldLabel, width: 100 }}>Deviation:</Text><Text style={s.fieldValue}>{c.deviation as string}</Text></View>
                          <View style={s.fieldRow}><Text style={{ ...s.fieldLabel, width: 100 }}>Immediate Action:</Text><Text style={s.fieldValue}>{c.immediateAction as string}</Text></View>
                          <View style={s.fieldRow}><Text style={{ ...s.fieldLabel, width: 100 }}>Product Disposition:</Text><Text style={s.fieldValue}>{c.productDisposition as string}</Text></View>
                          {c.responsiblePerson && <View style={s.fieldRow}><Text style={{ ...s.fieldLabel, width: 100 }}>Responsible:</Text><Text style={s.fieldValue}>{c.responsiblePerson as string}</Text></View>}
                        </View>
                      ))}
                    </>
                  )}
                  {verification.length > 0 && (
                    <>
                      <Text style={s.h3}>Verification Procedures</Text>
                      <View style={s.table}>
                        <View style={s.tableHeaderRow}>
                          {["Activity", "Frequency", "Responsible", "Method", "Record Ref."].map((h) => (
                            <Text key={h} style={{ ...s.th, flex: 1 }}>{h}</Text>
                          ))}
                        </View>
                        {verification.map((v: Record<string, any>, k: number) => (
                          <View key={k} style={s.tableRow}>
                            <Text style={{ ...s.td, flex: 1 }}>{v.activity as string}</Text>
                            <Text style={{ ...s.td, flex: 1 }}>{v.frequency as string}</Text>
                            <Text style={{ ...s.td, flex: 1 }}>{v.responsiblePerson as string}</Text>
                            <Text style={{ ...s.td, flex: 1 }}>{(v.method || "—") as string}</Text>
                            <Text style={{ ...s.td, flex: 1 }}>{(v.recordReference || "—") as string}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}
                </View>
              );
            })()}

            <PageFooter {...footerProps} />
          </Page>
        );
      })}

      {/* ── HACCP Team ───────────────────────────────────────────────────────── */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.h1}>HACCP Team</Text>
        {teamMembers.length === 0 ? (
          <Text style={s.para}>No team members recorded.</Text>
        ) : (
          <View style={s.table}>
            <View style={s.tableHeaderRow}>
              {["Name", "Title", "Role", "Qualifications"].map((h) => (
                <Text key={h} style={{ ...s.th, flex: 1 }}>{h}</Text>
              ))}
            </View>
            {teamMembers.map((m: Record<string, string>, i: number) => (
              <View key={i} style={s.tableRow}>
                <Text style={{ ...s.td, flex: 1 }}>{m.name}</Text>
                <Text style={{ ...s.td, flex: 1 }}>{m.title}</Text>
                <Text style={{ ...s.td, flex: 1 }}>{m.role}</Text>
                <Text style={{ ...s.td, flex: 1 }}>{m.qualifications}</Text>
              </View>
            ))}
          </View>
        )}
        <PageFooter {...footerProps} />
      </Page>

    </Document>
  );
}
