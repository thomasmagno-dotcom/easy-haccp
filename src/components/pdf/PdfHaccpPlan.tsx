import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 9, color: "#1a1a1a" },
  coverPage: { padding: 60, justifyContent: "center", alignItems: "center" },
  coverTitle: { fontSize: 24, fontFamily: "Helvetica-Bold", marginBottom: 10, textAlign: "center" },
  coverSubtitle: { fontSize: 14, color: "#555", marginBottom: 30, textAlign: "center" },
  coverDetail: { fontSize: 10, color: "#777", marginBottom: 4, textAlign: "center" },
  h1: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 8, marginTop: 16, borderBottomWidth: 1, borderBottomColor: "#ccc", paddingBottom: 4 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 6, marginTop: 12, color: "#333" },
  h3: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4, marginTop: 8, color: "#555" },
  para: { marginBottom: 4, lineHeight: 1.4 },
  table: { borderWidth: 1, borderColor: "#ddd" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#ddd" },
  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#999", backgroundColor: "#f5f5f5" },
  th: { padding: 4, fontFamily: "Helvetica-Bold", fontSize: 8 },
  td: { padding: 4, fontSize: 8 },
  fieldRow: { flexDirection: "row", marginBottom: 2 },
  fieldLabel: { width: 120, fontFamily: "Helvetica-Bold", fontSize: 8, color: "#555" },
  fieldValue: { flex: 1, fontSize: 8 },
  badge: { backgroundColor: "#dc2626", color: "#fff", paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2, fontSize: 7, fontFamily: "Helvetica-Bold" },
  stepFlow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#f0f0f0", justifyContent: "center", alignItems: "center", marginRight: 8 },
  stepNumText: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 20, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#999" },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PdfHaccpPlan({ snapshot }: { snapshot: any }) {
  const plan = snapshot.plan;
  const steps = snapshot.processSteps || [];
  let productDesc: Record<string, string> = {};
  try { productDesc = JSON.parse(plan.productDescription || "{}"); } catch {}
  let teamMembers: Array<Record<string, string>> = [];
  try { teamMembers = JSON.parse(plan.teamMembers || "[]"); } catch {}

  return (
    <Document>
      {/* Cover Page */}
      <Page size="LETTER" style={s.coverPage}>
        <Text style={s.coverTitle}>HACCP Plan</Text>
        <Text style={s.coverSubtitle}>{plan.name}</Text>
        <Text style={s.coverDetail}>{plan.facilityName}</Text>
        {plan.facilityAddress && <Text style={s.coverDetail}>{plan.facilityAddress}</Text>}
        <Text style={s.coverDetail}>Version {plan.currentVersion}</Text>
        <Text style={s.coverDetail}>{snapshot.snapshotAt ? new Date(snapshot.snapshotAt).toLocaleDateString("en-CA") : ""}</Text>
        <Text style={{ ...s.coverDetail, marginTop: 40, fontSize: 8 }}>
          Compliant with CFIA, SFCR, and SQF standards
        </Text>
      </Page>

      {/* Form 1: Product Description */}
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

        {/* Form 3: Process Flow */}
        <Text style={s.h1}>Form 3: Process Flow Diagram</Text>
        {steps.map((step: Record<string, any>, i: number) => (
          <View key={i} style={s.stepFlow}>
            <View style={s.stepNum}>
              <Text style={s.stepNumText}>{step.stepNumber as number}</Text>
            </View>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>
              {step.name as string}
            </Text>
            {step.isCcp && (
              <View style={{ ...s.badge, marginLeft: 6 }}>
                <Text>{step.ccpNumber as string}</Text>
              </View>
            )}
          </View>
        ))}

        <View style={s.footer}>
          <Text>{plan.name}</Text>
          <Text>HACCP Plan Manager</Text>
        </View>
      </Page>

      {/* Hazard Analysis per Step */}
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
                    <Text style={{ ...s.td, width: 30 }}>
                      {((hazard.type as string) || "").charAt(0).toUpperCase()}
                    </Text>
                    <Text style={{ ...s.td, flex: 1 }}>{hazard.name as string}</Text>
                    <Text style={{ ...s.td, width: 45 }}>
                      {(sh.severityOverride || hazard.severity || "—") as string}
                    </Text>
                    <Text style={{ ...s.td, width: 50 }}>
                      {(sh.likelihoodOverride || hazard.likelihood || "—") as string}
                    </Text>
                    <Text style={{ ...s.td, width: 30 }}>
                      {sh.isSignificant ? "Yes" : "No"}
                    </Text>
                    <Text style={{ ...s.td, flex: 1 }}>
                      {(sh.justification || "—") as string}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* CCP Details if applicable */}
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
                      {limits.map((l, k) => (
                        <Text key={k} style={s.para}>
                          {l.parameter as string}: {l.minimum ? `min ${l.minimum}` : ""}{l.maximum ? ` max ${l.maximum}` : ""}{l.target ? ` (target: ${l.target})` : ""} {l.unit as string}
                        </Text>
                      ))}
                    </>
                  )}

                  {monitoring.length > 0 && (
                    <>
                      <Text style={s.h3}>Monitoring</Text>
                      {monitoring.map((m, k) => (
                        <Text key={k} style={s.para}>
                          What: {m.what as string} | How: {m.how as string} | Freq: {m.frequency as string} | Who: {m.who as string}
                        </Text>
                      ))}
                    </>
                  )}

                  {corrective.length > 0 && (
                    <>
                      <Text style={s.h3}>Corrective Actions</Text>
                      {corrective.map((c, k) => (
                        <Text key={k} style={s.para}>
                          If: {c.deviation as string} — Action: {c.immediateAction as string} — Product: {c.productDisposition as string}
                        </Text>
                      ))}
                    </>
                  )}

                  {verification.length > 0 && (
                    <>
                      <Text style={s.h3}>Verification</Text>
                      {verification.map((v, k) => (
                        <Text key={k} style={s.para}>
                          {v.activity as string} — {v.frequency as string} ({v.responsiblePerson as string})
                        </Text>
                      ))}
                    </>
                  )}
                </View>
              );
            })()}

            <View style={s.footer}>
              <Text>{plan.name}</Text>
              <Text>Step {step.stepNumber as number} of {steps.length}</Text>
            </View>
          </Page>
        );
      })}

      {/* HACCP Team */}
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
            {teamMembers.map((m, i) => (
              <View key={i} style={s.tableRow}>
                <Text style={{ ...s.td, flex: 1 }}>{m.name}</Text>
                <Text style={{ ...s.td, flex: 1 }}>{m.title}</Text>
                <Text style={{ ...s.td, flex: 1 }}>{m.role}</Text>
                <Text style={{ ...s.td, flex: 1 }}>{m.qualifications}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={s.footer}>
          <Text>{plan.name}</Text>
          <Text>HACCP Plan Manager</Text>
        </View>
      </Page>
    </Document>
  );
}
