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
  stepBoxInner: { flexDirection: "row", alignItems: "center" },
  stepNum: { width: 22, height: 22, borderRadius: 11, justifyContent: "center", alignItems: "center", marginRight: 8, flexShrink: 0 },
  stepNumText: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  stepArrow: { alignItems: "center", height: 14, justifyContent: "center" },
  stepArrowLine: { width: 1, height: 8, backgroundColor: "#9ca3af" },
  stepArrowHead: { width: 6, height: 6, borderBottomWidth: 1, borderRightWidth: 1, borderColor: "#9ca3af", transform: "rotate(45deg)", marginTop: -1 },
  // Signature block
  sigSection: { marginTop: 32 },
  sigTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 16, color: "#333", borderBottomWidth: 1, borderBottomColor: "#ccc", paddingBottom: 4 },
  sigRow: { flexDirection: "row", gap: 24, marginBottom: 20 },
  sigBlock: { flex: 1 },
  sigLabel: { fontSize: 8, color: "#555", marginBottom: 20 },
  sigLine: { borderBottomWidth: 1, borderBottomColor: "#333", marginBottom: 4 },
  sigLineLabel: { fontSize: 7, color: "#888" },
  // Footer (fixed, appears on every page)
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, height: 40, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingHorizontal: 40, paddingTop: 8, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", backgroundColor: "#fff" },
  footerLeft: { flex: 1, fontSize: 7, color: "#6b7280" },
  footerCenter: { flex: 2, fontSize: 7, color: "#6b7280", textAlign: "center" },
  footerRight: { flex: 1, fontSize: 7, color: "#6b7280", textAlign: "right" },
});

// Format ISO datetime for PDF display
function fmtDateTime(iso: string): string {
  if (!iso) return "";
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(iso)
    ? iso.replace(" ", "T") + "Z"
    : iso;
  return new Date(normalized).toLocaleString("en-CA", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(iso)
    ? iso.replace(" ", "T") + "Z"
    : iso;
  return new Date(normalized).toLocaleDateString("en-CA", {
    year: "numeric", month: "short", day: "numeric",
  });
}

// ── Shared footer rendered on every page (except cover) ─────────────────────
function PageFooter({ planName, versionNumber, snapshotAt, publishedBy }: {
  planName: string;
  versionNumber: number;
  snapshotAt: string;
  publishedBy: string | null;
}) {
  const versionStr = `v${versionNumber}`;
  const dateStr = fmtDateTime(snapshotAt);
  const byStr = publishedBy ? `  |  Published by: ${publishedBy}` : "";

  return (
    <View style={s.footer} fixed>
      <Text style={s.footerLeft}>{planName}</Text>
      <Text style={s.footerCenter}>{versionStr}  |  {dateStr}{byStr}</Text>
      <Text
        style={s.footerRight}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
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
  const changeLog: any[] = snapshot.changeLog || [];
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
        {/* Title block — centred in top half */}
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={s.coverTitle}>HACCP Plan</Text>
          <Text style={s.coverSubtitle}>{plan.name}</Text>

          <View style={{ ...s.coverDivider, width: 260 }} />

          <Text style={s.coverDetail}>{plan.facilityName}</Text>
          {plan.facilityAddress && <Text style={s.coverDetail}>{plan.facilityAddress}</Text>}

          <View style={{ marginTop: 16, alignItems: "center" }}>
            <Text style={{ ...s.coverDetail, fontSize: 11, fontFamily: "Helvetica-Bold", color: "#333" }}>
              Version {versionNumber}
            </Text>
            <Text style={{ ...s.coverDetail, marginTop: 4 }}>
              {fmtDate(snapshotAt)}
            </Text>
            {publishedBy && (
              <Text style={{ ...s.coverDetail, marginTop: 2 }}>
                Published by: {publishedBy}
              </Text>
            )}
            {changeDescription && (
              <Text style={{ ...s.coverDetail, marginTop: 2, fontStyle: "italic" }}>
                &ldquo;{changeDescription}&rdquo;
              </Text>
            )}
          </View>

          <Text style={{ ...s.coverDetail, marginTop: 28, fontSize: 8, color: "#aaa" }}>
            Compliant with CFIA, SFCR, and SQF standards
          </Text>
        </View>

        {/* Signature block — bottom of cover */}
        <View style={s.sigSection}>
          <Text style={s.sigTitle}>Authorisation</Text>

          <View style={s.sigRow}>
            {/* Prepared by */}
            <View style={s.sigBlock}>
              <Text style={s.sigLabel}>Prepared by</Text>
              <View style={s.sigLine} />
              <Text style={s.sigLineLabel}>Signature</Text>
              <View style={{ marginTop: 14 }}>
                <View style={s.sigLine} />
                <Text style={s.sigLineLabel}>Print Name</Text>
              </View>
              <View style={{ marginTop: 14 }}>
                <View style={s.sigLine} />
                <Text style={s.sigLineLabel}>Title / Role</Text>
              </View>
              <View style={{ marginTop: 14 }}>
                <View style={s.sigLine} />
                <Text style={s.sigLineLabel}>Date</Text>
              </View>
            </View>

            {/* Approved by */}
            <View style={s.sigBlock}>
              <Text style={s.sigLabel}>Approved by</Text>
              <View style={s.sigLine} />
              <Text style={s.sigLineLabel}>Signature</Text>
              <View style={{ marginTop: 14 }}>
                <View style={s.sigLine} />
                <Text style={s.sigLineLabel}>Print Name</Text>
              </View>
              <View style={{ marginTop: 14 }}>
                <View style={s.sigLine} />
                <Text style={s.sigLineLabel}>Title / Role</Text>
              </View>
              <View style={{ marginTop: 14 }}>
                <View style={s.sigLine} />
                <Text style={s.sigLineLabel}>Date</Text>
              </View>
            </View>

            {/* Review scheduled */}
            <View style={s.sigBlock}>
              <Text style={s.sigLabel}>Next Review</Text>
              <View style={s.sigLine} />
              <Text style={s.sigLineLabel}>Scheduled Review Date</Text>
              <View style={{ marginTop: 14 }}>
                <View style={s.sigLine} />
                <Text style={s.sigLineLabel}>Reviewed by</Text>
              </View>
              <View style={{ marginTop: 14 }}>
                <View style={s.sigLine} />
                <Text style={s.sigLineLabel}>Signature</Text>
              </View>
              <View style={{ marginTop: 14 }}>
                <View style={s.sigLine} />
                <Text style={s.sigLineLabel}>Date</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Cover footer (no page number shown — it's the title page) */}
        <View style={{ ...s.footer, borderTopColor: "#e5e7eb" }} fixed>
          <Text style={s.footerLeft}>{plan.name}</Text>
          <Text style={s.footerCenter}>v{versionNumber}  |  {fmtDateTime(snapshotAt)}{publishedBy ? `  |  ${publishedBy}` : ""}</Text>
          <Text style={s.footerRight}>HACCP Plan</Text>
        </View>
      </Page>

      {/* ── Document Control — Amendment Logbook ────────────────────────────── */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.h1}>Document Control — Amendment Logbook</Text>

        {allVersions.length === 0 ? (
          <Text style={{ ...s.para, color: "#6b7280", fontStyle: "italic" }}>
            No published versions yet. This document reflects the current working draft.
          </Text>
        ) : (
          <>
            {/* ── Summary table of all versions ── */}
            <Text style={s.h2}>Version History Summary</Text>
            <View style={{ ...s.table, marginBottom: 16 }}>
              <View style={s.tableHeaderRow}>
                <Text style={{ ...s.th, width: 52 }}>Version</Text>
                <Text style={{ ...s.th, width: 118 }}>Date &amp; Time</Text>
                <Text style={{ ...s.th, width: 110 }}>Published By</Text>
                <Text style={{ ...s.th, flex: 1 }}>Notes / Description</Text>
                <Text style={{ ...s.th, width: 40, textAlign: "center" }}>Changes</Text>
              </View>
              {allVersions.map((v: any, i: number) => (
                <View key={i} style={{ ...s.tableRow, backgroundColor: i === 0 ? "#f0fdf4" : "transparent" }}>
                  <Text style={{ ...s.td, width: 52, fontFamily: "Helvetica-Bold" }}>
                    v{v.versionNumber}{i === 0 ? " ★" : ""}
                  </Text>
                  <Text style={{ ...s.td, width: 118 }}>{fmtDateTime(v.publishedAt)}</Text>
                  <Text style={{ ...s.td, width: 110 }}>{v.publishedBy || "—"}</Text>
                  <Text style={{ ...s.td, flex: 1 }}>{v.changeDescription || "—"}</Text>
                  <Text style={{ ...s.td, width: 40, textAlign: "center" }}>
                    {(v.changeLog?.length ?? 0) > 0 ? String(v.changeLog.length) : "—"}
                  </Text>
                </View>
              ))}
            </View>

            {/* ── Per-version detailed change log ── */}
            <Text style={s.h2}>Detailed Amendment Log</Text>
            {allVersions.map((v: any, vi: number) => {
              const log: any[] = v.changeLog || [];
              const sectionLabels: Record<string, string> = {
                plan: "Plan & Product",
                team: "HACCP Team",
                steps: "Process Steps",
                ingredients: "Ingredients",
              };

              // Group entries by section
              const grouped: Record<string, string[]> = {};
              for (const entry of log) {
                const sec: string = entry.section || "other";
                if (!grouped[sec]) grouped[sec] = [];
                grouped[sec].push(entry.text);
              }

              return (
                <View key={vi} style={{ marginBottom: 12, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 4 }} wrap={false}>
                  {/* Version header bar */}
                  <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: vi === 0 ? "#f0fdf4" : "#f9fafb", borderBottomWidth: log.length > 0 ? 1 : 0, borderBottomColor: "#e5e7eb", paddingHorizontal: 8, paddingVertical: 5 }}>
                    <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: "#111827", width: 52 }}>
                      v{v.versionNumber}
                    </Text>
                    <Text style={{ fontSize: 8, color: "#6b7280", width: 120 }}>
                      {fmtDateTime(v.publishedAt)}
                    </Text>
                    <Text style={{ fontSize: 8, color: "#374151", width: 110 }}>
                      {v.publishedBy ? `By: ${v.publishedBy}` : ""}
                    </Text>
                    <Text style={{ fontSize: 8, color: "#374151", flex: 1, fontStyle: v.changeDescription ? "italic" : "normal" }}>
                      {v.changeDescription || (log.length === 0 ? "No changes recorded" : "")}
                    </Text>
                  </View>

                  {/* Change entries grouped by section */}
                  {log.length > 0 && (
                    <View style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
                      {Object.entries(grouped).map(([sec, items], si) => (
                        <View key={si} style={{ marginBottom: si < Object.keys(grouped).length - 1 ? 6 : 0 }}>
                          {/* Section badge */}
                          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
                            <View style={{ backgroundColor: sec === "plan" ? "#dbeafe" : sec === "team" ? "#ede9fe" : sec === "steps" ? "#fef9c3" : "#dcfce7", borderRadius: 2, paddingHorizontal: 4, paddingVertical: 1 }}>
                              <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: sec === "plan" ? "#1d4ed8" : sec === "team" ? "#7c3aed" : sec === "steps" ? "#a16207" : "#15803d" }}>
                                {sectionLabels[sec] || sec}
                              </Text>
                            </View>
                          </View>
                          {/* Bullet entries */}
                          {(items as string[]).map((text, k) => (
                            <View key={k} style={{ flexDirection: "row", marginBottom: 1.5, paddingLeft: 6 }}>
                              <Text style={{ fontSize: 7.5, color: "#374151", width: 8 }}>•</Text>
                              <Text style={{ fontSize: 7.5, color: "#374151", flex: 1, lineHeight: 1.4 }}>{text}</Text>
                            </View>
                          ))}
                        </View>
                      ))}
                    </View>
                  )}
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

      {/* ── Form 2: Ingredients & Incoming Materials ────────────────────────── */}
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
                  {ing.category && (
                    <Text style={{ fontSize: 7, color: "#6b7280", marginRight: 8 }}>
                      {(ing.category as string).replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    </Text>
                  )}
                  {ing.supplier && <Text style={{ fontSize: 7, color: "#9ca3af" }}>Supplier: {ing.supplier as string}</Text>}
                </View>
                {ing.description && (
                  <Text style={{ ...s.para, fontSize: 7, color: "#555", marginLeft: 4, marginBottom: 3 }}>{ing.description as string}</Text>
                )}
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
                            <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: "#374151", marginBottom: 2 }}>Control Measures:</Text>
                            {cms.map((cm: Record<string, any>, k: number) => (
                              <Text key={k} style={{ fontSize: 7, color: "#374151", marginBottom: 1 }}>
                                • [{((cm.type as string) || "preventive").replace(/-/g, " ")}] {cm.description as string}
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
          const hazardCount = ((step.hazards as any[]) || []).length;

          let bgColor = "#fefce8", borderColor = "#fde047";
          let numBg = "#e5e7eb", numTextColor = "#1a1a1a";

          if (isCcp) {
            bgColor = "#fee2e2"; borderColor = "#fca5a5";
            numBg = "#dc2626"; numTextColor = "#ffffff";
          } else if (stepType === "receiving") {
            bgColor = "#dbeafe"; borderColor = "#93c5fd";
          } else if (stepType === "storage") {
            bgColor = "#cffafe"; borderColor = "#67e8f9";
          }

          const stepInputsList = (step.inputs as any[]) || [];

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
                  <View style={{ ...s.stepNum, backgroundColor: numBg }}>
                    <Text style={{ ...s.stepNumText, color: numTextColor }}>{step.stepNumber as number}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                      <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", marginRight: 4 }}>{step.name as string}</Text>
                      {isCcp && <View style={{ ...s.badge, marginRight: 6 }}><Text>{step.ccpNumber as string}</Text></View>}
                      {isCcp && <Text style={{ fontSize: 8, color: "#dc2626" }}>Critical Control Point</Text>}
                    </View>
                    {stepType !== "" && <Text style={{ fontSize: 7, color: "#6b7280", marginTop: 1 }}>{stepType.charAt(0).toUpperCase() + stepType.slice(1)}</Text>}
                    {step.description && (
                      <Text style={{ fontSize: 7, color: "#555", marginTop: 2 }}>
                        {(step.description as string).length > 80 ? (step.description as string).substring(0, 80) + "..." : step.description as string}
                      </Text>
                    )}
                    {stepInputsList.length > 0 && (
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
                        <Text style={{ fontSize: 7, color: "#6b7280", marginRight: 2, alignSelf: "center" }}>Inputs:</Text>
                        {stepInputsList.map((inp: any, k: number) => {
                          const typeKey = (inp.type as string) || "other";
                          const col = INPUT_COLORS[typeKey] || INPUT_COLORS.other;
                          return (
                            <View key={k} style={{ backgroundColor: col.bg, borderWidth: 1, borderColor: col.border, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 }}>
                              <Text style={{ fontSize: 7, color: col.text, fontFamily: "Helvetica-Bold" }}>{inp.name as string}</Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                  {hazardCount > 0 && (
                    <View style={{ backgroundColor: "#f3f4f6", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6 }}>
                      <Text style={{ fontSize: 7, color: "#374151" }}>{hazardCount} hazard{hazardCount > 1 ? "s" : ""}</Text>
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
        const stepHazards = (step.hazards as any[]) || [];
        if (stepHazards.length === 0) return null;

        return (
          <Page key={i} size="LETTER" style={s.page}>
            <Text style={s.h1}>
              Step {step.stepNumber as number}: {step.name as string}
              {step.isCcp ? ` (${step.ccpNumber})` : ""}
            </Text>
            {step.description && <Text style={s.para}>{step.description as string}</Text>}

            <Text style={s.h2}>Hazard Identification</Text>
            <View style={s.table}>
              <View style={s.tableHeaderRow}>
                <Text style={{ ...s.th, width: 30 }}>Type</Text>
                <Text style={{ ...s.th, flex: 1 }}>Hazard</Text>
                <Text style={{ ...s.th, width: 45 }}>Severity</Text>
                <Text style={{ ...s.th, width: 50 }}>Likelihood</Text>
                <Text style={{ ...s.th, width: 30 }}>Sig?</Text>
                <Text style={{ ...s.th, flex: 1 }}>Justification</Text>
              </View>
              {stepHazards.map((sh: Record<string, any>, j: number) => {
                const hazard = sh.hazard as Record<string, any>;
                return (
                  <View key={j} style={s.tableRow}>
                    <Text style={{ ...s.td, width: 30 }}>{((hazard.type as string) || "").charAt(0).toUpperCase()}</Text>
                    <Text style={{ ...s.td, flex: 1 }}>{hazard.name as string}</Text>
                    <Text style={{ ...s.td, width: 45 }}>{(sh.severityOverride || hazard.severity || "—") as string}</Text>
                    <Text style={{ ...s.td, width: 50 }}>{(sh.likelihoodOverride || hazard.likelihood || "—") as string}</Text>
                    <Text style={{ ...s.td, width: 30 }}>{sh.isSignificant ? "Yes" : "No"}</Text>
                    <Text style={{ ...s.td, flex: 1 }}>{(sh.justification || "—") as string}</Text>
                  </View>
                );
              })}
            </View>

            {step.ccp && (() => {
              const ccp = step.ccp as Record<string, any>;
              const limits = (ccp.criticalLimits as any[]) || [];
              const monitoring = (ccp.monitoringProcedures as any[]) || [];
              const corrective = (ccp.correctiveActions as any[]) || [];
              const verification = (ccp.verificationProcedures as any[]) || [];
              return (
                <View>
                  <Text style={s.h2}>CCP Details — {step.ccpNumber as string}</Text>
                  <View style={s.fieldRow}>
                    <Text style={s.fieldLabel}>Hazard(s):</Text>
                    <Text style={s.fieldValue}>{ccp.hazardDescription as string}</Text>
                  </View>
                  <View style={s.fieldRow}>
                    <Text style={s.fieldLabel}>Control Measure:</Text>
                    <Text style={s.fieldValue}>{ccp.controlMeasureDescription as string}</Text>
                  </View>
                  {limits.length > 0 && (
                    <>
                      <Text style={s.h3}>Critical Limits</Text>
                      {limits.map((l: Record<string, any>, k: number) => (
                        <Text key={k} style={s.para}>
                          {l.parameter as string}: {l.minimum ? `min ${l.minimum}` : ""}{l.maximum ? ` max ${l.maximum}` : ""}{l.target ? ` (target: ${l.target})` : ""} {l.unit as string}
                        </Text>
                      ))}
                    </>
                  )}
                  {monitoring.length > 0 && (
                    <>
                      <Text style={s.h3}>Monitoring</Text>
                      {monitoring.map((m: Record<string, any>, k: number) => (
                        <Text key={k} style={s.para}>
                          What: {m.what as string} | How: {m.how as string} | Freq: {m.frequency as string} | Who: {m.who as string}
                        </Text>
                      ))}
                    </>
                  )}
                  {corrective.length > 0 && (
                    <>
                      <Text style={s.h3}>Corrective Actions</Text>
                      {corrective.map((c: Record<string, any>, k: number) => (
                        <Text key={k} style={s.para}>
                          If: {c.deviation as string} — Action: {c.immediateAction as string} — Product: {c.productDisposition as string}
                        </Text>
                      ))}
                    </>
                  )}
                  {verification.length > 0 && (
                    <>
                      <Text style={s.h3}>Verification</Text>
                      {verification.map((v: Record<string, any>, k: number) => (
                        <Text key={k} style={s.para}>
                          {v.activity as string} — {v.frequency as string} ({v.responsiblePerson as string})
                        </Text>
                      ))}
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
              <Text style={{ ...s.th, flex: 1 }}>Name</Text>
              <Text style={{ ...s.th, flex: 1 }}>Title</Text>
              <Text style={{ ...s.th, flex: 1 }}>Role</Text>
              <Text style={{ ...s.th, flex: 1 }}>Qualifications</Text>
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
