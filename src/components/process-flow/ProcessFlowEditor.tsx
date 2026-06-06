"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { FlowNode } from "./FlowNode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProcessStep {
  id: string;
  planId: string;
  stepNumber: number;
  name: string;
  description: string | null;
  category: string | null;
  isCcp: boolean;
  ccpNumber: string | null;
  isSharedMaster?: boolean;
  // Junction fields (present after junction migration)
  junctionId?: string;
  sequence?: number;
  isShared?: boolean;
  localOverrides?: { name?: string; description?: string } | null;
  masterName?: string;
  masterDescription?: string;
}

interface StepInput {
  id: string;
  stepId: string;
  name: string;
  type: string | null;
  notes: string | null;
  createdAt: string;
}

interface SubgraphStep {
  id: string;
  inputId: string;
  name: string;
  stepNumber: number;
  category: string | null;
  createdAt: string;
}

interface StepOutput {
  id: string;
  stepId: string;
  name: string;
  outputType: string;
  description: string | null;
  isCcp: boolean;
  ccpNumber: string | null;
}

interface FlowChart {
  id: string;
  name: string;
  flowChartType: string;
}

interface StepConnectionInfo {
  id: string;
  sourceStepId: string;
  targetStepId: string;
  sourceOutputId: string;
  connectionType: string;
  sourceStepName: string | null;
  targetStepName: string | null;
  sourceOutputName: string | null;
  sourceOutputType: string | null;
  sourceFlowChartName: string | null;
  targetFlowChartName: string | null;
  sourceFlowChartId: string;
  targetFlowChartId: string;
  // All steps (primary + additional sources) that produce this output
  allSourceSteps?: Array<{ stepName: string; stepNumber: number; stepLabel?: string }>;
}

interface OutputSource {
  id: string;
  stepId: string;
  stepName: string;
  stepNumber: number;
  stepLabel: string;   // e.g. "A3", "B1"
}

interface StepForPicker {
  id: string;
  name: string;
  stepNumber: number;
  sequence: number | null;   // chart-local sequence from the picker API
  isCcp: boolean;
  ccpNumber: string | null;
  flowChartId: string | null;
  flowChartName: string | null;
}

interface Props {
  planId: string;
  flowCharts?: FlowChart[];
  activeFlowChartId?: string;
  initialSteps: ProcessStep[];
  hazardCounts: Record<string, number>;
  hazardTypesByStep?: Record<string, string[]>;
  initialInputs: Record<string, StepInput[]>;
  initialSubgraphSteps: Record<string, SubgraphStep[]>;
  hazardTypesBySubgraphStep?: Record<string, string[]>;
  initialOutputsByStep?: Record<string, StepOutput[]>;
  hazardTypesByOutput?: Record<string, string[]>;
  connectionsFromOutput?: Record<string, StepConnectionInfo[]>;
  connectionsToStep?: Record<string, StepConnectionInfo[]>;
  // outputId → list of additional source steps (not the primary owner)
  initialOutputSourcesByOutput?: Record<string, OutputSource[]>;
  // chartId → letter (A, B, C…) — used to compute step labels like "A3"
  chartLetterById?: Record<string, string>;
  // stepId → label covering ALL charts in the plan (e.g. "B3") — for cross-chart references
  stepGlobalLabelMap?: Record<string, string>;
}

const FLOW_CHART_TYPE_LABELS: Record<string, string> = {
  main_process:        "Main Process",
  byproduct:           "By-Product",
  incoming_ingredient: "Incoming Ingredient",
  waste_stream:        "Waste Stream",
  other:               "Other",
};

export function ProcessFlowEditor({
  planId,
  flowCharts: initialFlowCharts = [],
  activeFlowChartId,
  initialSteps,
  hazardCounts,
  hazardTypesByStep = {},
  initialInputs,
  initialSubgraphSteps,
  hazardTypesBySubgraphStep = {},
  initialOutputsByStep,
  hazardTypesByOutput = {},
  connectionsFromOutput: initialConnectionsFromOutput = {},
  connectionsToStep: initialConnectionsToStep = {},
  initialOutputSourcesByOutput = {},
  chartLetterById = {},
  stepGlobalLabelMap = {},
}: Props) {
  const [steps, setSteps] = useState(initialSteps);
  const [inputsByStep, setInputsByStep] = useState<Record<string, StepInput[]>>(initialInputs);
  const [subgraphStepsByInput, setSubgraphStepsByInput] = useState<Record<string, SubgraphStep[]>>(initialSubgraphSteps);
  const [outputsByStep, setOutputsByStep] = useState<Record<string, StepOutput[]>>(initialOutputsByStep ?? {});
  const [newStepName, setNewStepName] = useState("");
  const [newStepCategory, setNewStepCategory] = useState("processing");
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  // Connections state (live-updated on create/delete)
  const [connectionsFromOutput, setConnectionsFromOutput] = useState<Record<string, StepConnectionInfo[]>>(
    initialConnectionsFromOutput ?? {},
  );
  const [connectionsToStep, setConnectionsToStep] = useState<Record<string, StepConnectionInfo[]>>(
    initialConnectionsToStep ?? {},
  );

  // Output sources state
  const [outputSourcesByOutput, setOutputSourcesByOutput] = useState<Record<string, OutputSource[]>>(
    initialOutputSourcesByOutput,
  );
  // ── Active chart letter (A, B, C…) ─────────────────────────────────────────
  // Computed from chartLetterById (server-provided), falling back to the initial
  // flow chart list. Uses initialFlowCharts to avoid a forward-reference to the
  // flowCharts state (which is declared further below).
  const activeChartLetter = useMemo(() => {
    if (activeFlowChartId && chartLetterById[activeFlowChartId]) {
      return chartLetterById[activeFlowChartId];
    }
    const idx = initialFlowCharts.findIndex((c) => c.id === activeFlowChartId);
    return String.fromCharCode(65 + Math.max(0, idx));
  }, [activeFlowChartId, chartLetterById, initialFlowCharts]);

  // stepLabel: helper that converts a step's sequence to "A3", "B2", etc.
  const makeStepLabel = (stepObj: { sequence?: number; stepNumber: number }) =>
    `${activeChartLetter}${stepObj.sequence ?? stepObj.stepNumber}`;

  // ── Derived: shared outputs per step ───────────────────────────────────────
  // For every (outputId → [source steps]) entry in outputSourcesByOutput, each
  // source step should also show that output in its right column.  Rather than
  // relying on the server pre-populating outputsByStep[sourceStep.id], compute
  // it here so the component is self-sufficient.
  const sharedOutputsByStep = useMemo(() => {
    const result: Record<string, StepOutput[]> = {};
    for (const [outputId, sources] of Object.entries(outputSourcesByOutput)) {
      // Find the output object from any step's direct output list
      let output: StepOutput | undefined;
      for (const outs of Object.values(outputsByStep)) {
        output = outs.find((o) => o.id === outputId);
        if (output) break;
      }
      if (!output) continue;
      for (const src of sources) {
        if (!result[src.stepId]) result[src.stepId] = [];
        if (!result[src.stepId].find((o) => o.id === outputId)) {
          result[src.stepId].push(output);
        }
      }
    }
    return result;
  }, [outputSourcesByOutput, outputsByStep]);

  // ── Derived: all producing steps per output ─────────────────────────────────
  // For every output, build the full list of steps that produce it:
  // [primary owner] + [additional sources from outputSourcesByOutput].
  // Used to show "Steps: 3 · 10" on every output card (both primary and shared copies).
  const allProducingStepsByOutput = useMemo(() => {
    const result: Record<string, Array<{ stepId: string; stepName: string; stepNumber: number; stepLabel: string; sourceId?: string }>> = {};
    for (const outs of Object.values(outputsByStep)) {
      for (const out of outs) {
        if (result[out.id]) continue; // already processed (avoid duplicates from shared copies)
        // Only build once, keyed by the primary owner step
        const primaryStep = steps.find((s) => s.id === out.stepId);
        if (!primaryStep && !steps.some((s) => s.id === out.stepId)) continue;
        result[out.id] = [];
        // Primary owner — use global label map if available (handles cross-chart shared steps)
        if (primaryStep) {
          result[out.id].push({
            stepId: primaryStep.id,
            stepName: primaryStep.name,
            stepNumber: primaryStep.sequence ?? primaryStep.stepNumber,
            stepLabel: stepGlobalLabelMap[primaryStep.id] ?? makeStepLabel(primaryStep),
          });
        }
        // Additional sources (each has a sourceId for the delete button)
        for (const src of outputSourcesByOutput[out.id] ?? []) {
          if (!result[out.id].find((e) => e.stepId === src.stepId)) {
            result[out.id].push({
              stepId: src.stepId,
              stepName: src.stepName,
              stepNumber: src.stepNumber,
              stepLabel: src.stepLabel,
              sourceId: src.id,
            });
          }
        }
      }
    }
    return result;
  }, [outputsByStep, outputSourcesByOutput, steps, makeStepLabel, stepGlobalLabelMap]);

  // ── Derived: output type lookup by outputId ─────────────────────────────────
  // Used to enrich connections with the correct sourceOutputType when it is
  // missing (e.g. connections created in-session before a full reload).
  const outputTypeById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const outs of Object.values(outputsByStep)) {
      for (const out of outs) {
        map[out.id] = out.outputType;
      }
    }
    return map;
  }, [outputsByStep]);

  // ── Derived: connectionsToStep — re-indexed from connectionsFromOutput ───────
  // connectionsFromOutput is the authoritative live state (always updated on
  // create / delete). Deriving connectionsToStep from it ensures the connected-
  // input boxes on the left side never disappear due to a state-sync gap.
  const derivedConnectionsToStep = useMemo(() => {
    const result: Record<string, StepConnectionInfo[]> = {};
    for (const conns of Object.values(connectionsFromOutput)) {
      for (const conn of conns) {
        const sid = conn.targetStepId;
        if (!result[sid]) result[sid] = [];
        if (result[sid].find((c) => c.id === conn.id)) continue;

        // Enrich sourceOutputType from local lookup if missing
        const outputType = conn.sourceOutputType ?? outputTypeById[conn.sourceOutputId] ?? null;

        // Enrich allSourceSteps if missing (server may have provided it; fall back to outputSourcesByOutput)
        let allSourceSteps = conn.allSourceSteps;
        if (!allSourceSteps || allSourceSteps.length === 0) {
          const additional = outputSourcesByOutput[conn.sourceOutputId] ?? [];
          allSourceSteps = [];
          if (conn.sourceStepName) {
            const srcStepObj = steps.find((s) => s.id === conn.sourceStepId);
            const seq = srcStepObj?.sequence ?? srcStepObj?.stepNumber ?? 0;
            const srcChartLetter = (conn.sourceFlowChartId && chartLetterById[conn.sourceFlowChartId])
              ? chartLetterById[conn.sourceFlowChartId]
              : activeChartLetter;
            // Prefer the global label map (correct for cross-chart steps)
            const lbl = stepGlobalLabelMap[conn.sourceStepId] ?? `${srcChartLetter}${seq}`;
            allSourceSteps.push({ stepName: conn.sourceStepName, stepNumber: seq, stepLabel: lbl });
          }
          for (const s of additional) {
            if (!allSourceSteps.find((x) => x.stepName === s.stepName)) {
              allSourceSteps.push({ stepName: s.stepName, stepNumber: s.stepNumber, stepLabel: s.stepLabel });
            }
          }
        }

        result[sid].push({ ...conn, sourceOutputType: outputType, allSourceSteps });
      }
    }
    return result;
  }, [connectionsFromOutput, outputTypeById, outputSourcesByOutput, stepGlobalLabelMap, chartLetterById, steps, activeChartLetter]);

  // "Link step as source" dialog
  const [linkSourceOutputId, setLinkSourceOutputId] = useState<string | null>(null);
  const [linkSourceOwnerStepId, setLinkSourceOwnerStepId] = useState<string | null>(null);
  const [linkSourceTargetStepId, setLinkSourceTargetStepId] = useState("");
  const [linkSourceSaving, setLinkSourceSaving] = useState(false);
  const [linkSourceError, setLinkSourceError] = useState<string | null>(null);

  // Sync all chart-scoped state when activeFlowChartId changes (handles soft
  // navigation where React may not remount despite the key prop).
  const [renderedChartId, setRenderedChartId] = useState(activeFlowChartId);
  if (renderedChartId !== activeFlowChartId) {
    setRenderedChartId(activeFlowChartId);
    setSteps(initialSteps);
    setInputsByStep(initialInputs);
    setSubgraphStepsByInput(initialSubgraphSteps);
    setOutputsByStep(initialOutputsByStep ?? {});
    setConnectionsFromOutput(initialConnectionsFromOutput ?? {});
    setConnectionsToStep(initialConnectionsToStep ?? {});
    setOutputSourcesByOutput(initialOutputSourcesByOutput);
    // hazardTypesBySubgraphStep is a plain prop — it re-reads from the new value automatically
  }
  // Connection creation dialog
  const [connectDialogOutputId, setConnectDialogOutputId] = useState<string | null>(null);
  const [connectDialogStepId, setConnectDialogStepId] = useState<string | null>(null);
  const [connectTargetStepId, setConnectTargetStepId] = useState("");
  const [connectTargetFlowChartId, setConnectTargetFlowChartId] = useState("");
  const [connectType, setConnectType] = useState<"" | "direct" | "reference">("");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectSaving, setConnectSaving] = useState(false);
  const [allStepsForPicker, setAllStepsForPicker] = useState<StepForPicker[]>([]);
  // Flow chart management
  const [flowCharts, setFlowCharts] = useState(initialFlowCharts);
  const [showNewChartDialog, setShowNewChartDialog] = useState(false);
  const [newChartName, setNewChartName] = useState("");
  const [newChartType, setNewChartType] = useState("main_process");
  const [newChartDesc, setNewChartDesc] = useState("");
  const [creatingChart, setCreatingChart] = useState(false);
  // Flow chart edit dialog
  const [editChartTarget, setEditChartTarget] = useState<FlowChart | null>(null);
  const [editChartName, setEditChartName] = useState("");
  const [editChartType, setEditChartType] = useState("main_process");
  const [savingChart, setSavingChart] = useState(false);
  // Shared Steps — link existing step dialog
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkResults, setLinkResults] = useState<(ProcessStep & { homePlanName: string; homePlanId: string })[]>([]);
  const [linking, setLinking] = useState(false);
  // Local overrides editor
  const [overrideTarget, setOverrideTarget] = useState<ProcessStep | null>(null);
  const [overrideName, setOverrideName] = useState("");
  const [overrideDesc, setOverrideDesc] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Process step CRUD ──────────────────────────────────────────────────────

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(steps, oldIndex, newIndex).map((s, i) => ({ ...s, stepNumber: i + 1 }));
    const previousSteps = steps;
    setSteps(reordered);

    const res = await fetch(`/api/plans/${planId}/process-steps?chartId=${activeFlowChartId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reorder", stepIds: reordered.map((s) => s.id) }),
    });
    if (!res.ok) setSteps(previousSteps);
  }

  async function addStep() {
    if (!newStepName.trim()) return;
    setAdding(true);
    const res = await fetch(`/api/plans/${planId}/process-steps?chartId=${activeFlowChartId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newStepName.trim(), category: newStepCategory }),
    });
    if (res.ok) {
      const step = await res.json();
      setSteps([...steps, step]);
      setNewStepName("");
      setShowAddForm(false);
    }
    setAdding(false);
  }

  async function deleteStep(stepId: string) {
    const res = await fetch(`/api/plans/${planId}/process-steps?stepId=${stepId}&chartId=${activeFlowChartId}`, { method: "DELETE" });
    if (res.ok) {
      setSteps((prev) => prev.filter((s) => s.id !== stepId).map((s, i) => ({ ...s, stepNumber: i + 1 })));
      setInputsByStep((prev) => { const next = { ...prev }; delete next[stepId]; return next; });
      setOutputsByStep((prev) => { const next = { ...prev }; delete next[stepId]; return next; });
    }
  }

  async function renameStep(stepId: string, name: string) {
    const res = await fetch(`/api/plans/${planId}/process-steps`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: stepId, name }),
    });
    if (res.ok) {
      setSteps((prev) => prev.map((s) => s.id === stepId ? { ...s, name } : s));
    }
  }

  async function duplicateStep(stepId: string) {
    const res = await fetch(`/api/plans/${planId}/process-steps?chartId=${activeFlowChartId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "duplicate", stepId }),
    });
    if (res.ok) {
      const step = await res.json();
      setSteps((prev) => [...prev, step]);
    }
  }

  // ── Flow chart management ──────────────────────────────────────────────────

  async function createFlowChart() {
    if (!newChartName.trim()) return;
    setCreatingChart(true);
    const res = await fetch(`/api/plans/${planId}/flow-charts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newChartName.trim(), description: newChartDesc.trim() || null, flowChartType: newChartType }),
    });
    if (res.ok) {
      const created = await res.json();
      setFlowCharts((prev) => [...prev, created]);
      setShowNewChartDialog(false);
      setNewChartName(""); setNewChartDesc(""); setNewChartType("main_process");
      // Navigate to the new chart
      router.push(`/plans/${planId}/process-flow?chartId=${created.id}`);
    }
    setCreatingChart(false);
  }

  // ── Link existing step (Shared Steps) ─────────────────────────────────────

  async function searchLinkableSteps(q: string) {
    const res = await fetch(`/api/plans/${planId}/flow-chart-steps?q=${encodeURIComponent(q)}`);
    if (res.ok) setLinkResults(await res.json());
  }

  async function linkStep(stepId: string) {
    setLinking(true);
    const res = await fetch(`/api/plans/${planId}/flow-chart-steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId }),
    });
    if (res.ok) {
      const data = await res.json();
      const newStep: ProcessStep = {
        ...data.step,
        junctionId: data.junctionId,
        sequence: data.sequence,
        isShared: true,
        localOverrides: null,
        masterName: data.step.name,
        masterDescription: data.step.description,
      };
      setSteps((prev) => [...prev, newStep]);
      setShowLinkDialog(false);
      setLinkSearch("");
      setLinkResults([]);
    }
    setLinking(false);
  }

  // ── Local overrides ────────────────────────────────────────────────────────

  function openOverrideEditor(step: ProcessStep) {
    setOverrideTarget(step);
    setOverrideName(step.localOverrides?.name ?? "");
    setOverrideDesc(step.localOverrides?.description ?? "");
  }

  async function saveOverride() {
    if (!overrideTarget?.junctionId) return;
    setSavingOverride(true);

    const overrides: Record<string, string | null> = {};
    if (overrideName.trim() && overrideName !== overrideTarget.masterName) {
      overrides.name = overrideName.trim();
    } else {
      overrides.name = null; // clear override if same as master
    }
    if (overrideDesc.trim() !== (overrideTarget.masterDescription ?? "")) {
      overrides.description = overrideDesc.trim() || null;
    }

    const res = await fetch(`/api/plans/${planId}/flow-chart-steps`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        junctionId: overrideTarget.junctionId,
        localOverrides: overrides,
      }),
    });

    if (res.ok) {
      const { localOverrides } = await res.json();
      setSteps((prev) =>
        prev.map((s) =>
          s.id === overrideTarget.id
            ? {
                ...s,
                localOverrides,
                name: localOverrides?.name ?? s.masterName ?? s.name,
                description: localOverrides?.description ?? s.masterDescription ?? s.description,
              }
            : s,
        ),
      );
    }
    setSavingOverride(false);
    setOverrideTarget(null);
  }

  async function clearOverride(step: ProcessStep) {
    if (!step.junctionId) return;
    const res = await fetch(`/api/plans/${planId}/flow-chart-steps`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ junctionId: step.junctionId, clearOverrides: true }),
    });
    if (res.ok) {
      setSteps((prev) =>
        prev.map((s) =>
          s.id === step.id
            ? { ...s, localOverrides: null, name: s.masterName ?? s.name, description: s.masterDescription ?? s.description }
            : s,
        ),
      );
    }
  }

  // ── Step input CRUD ────────────────────────────────────────────────────────

  async function addInput(stepId: string, name: string, type: string) {
    const res = await fetch(`/api/plans/${planId}/step-inputs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId, name, type }),
    });
    if (res.ok) {
      const inp: StepInput = await res.json();
      setInputsByStep((prev) => ({ ...prev, [stepId]: [...(prev[stepId] || []), inp] }));
    }
  }

  async function deleteInput(stepId: string, inputId: string) {
    const res = await fetch(`/api/plans/${planId}/step-inputs?inputId=${inputId}`, { method: "DELETE" });
    if (res.ok) {
      setInputsByStep((prev) => ({ ...prev, [stepId]: (prev[stepId] || []).filter((i) => i.id !== inputId) }));
      // Also remove any subgraph steps for this input
      setSubgraphStepsByInput((prev) => { const next = { ...prev }; delete next[inputId]; return next; });
    }
  }

  // ── Input subgraph step CRUD ───────────────────────────────────────────────

  async function addSubgraphStep(inputId: string, name: string, category: string) {
    const res = await fetch(`/api/plans/${planId}/input-subgraph-steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputId, name, category }),
    });
    if (res.ok) {
      const ss: SubgraphStep = await res.json();
      setSubgraphStepsByInput((prev) => ({ ...prev, [inputId]: [...(prev[inputId] || []), ss] }));
    }
  }

  async function deleteSubgraphStep(inputId: string, subgraphStepId: string) {
    const res = await fetch(
      `/api/plans/${planId}/input-subgraph-steps?subgraphStepId=${subgraphStepId}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      setSubgraphStepsByInput((prev) => ({
        ...prev,
        [inputId]: (prev[inputId] || [])
          .filter((ss) => ss.id !== subgraphStepId)
          .map((ss, i) => ({ ...ss, stepNumber: i + 1 })),
      }));
    }
  }

  async function moveSubgraphStep(inputId: string, subgraphStepId: string, direction: "up" | "down") {
    const current = [...(subgraphStepsByInput[inputId] || [])].sort((a, b) => a.stepNumber - b.stepNumber);
    const idx = current.findIndex((ss) => ss.id === subgraphStepId);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= current.length) return;

    // Swap step numbers optimistically
    const swappedA = { ...current[idx], stepNumber: current[targetIdx].stepNumber };
    const swappedB = { ...current[targetIdx], stepNumber: current[idx].stepNumber };
    const updated = current.map((ss) => {
      if (ss.id === swappedA.id) return swappedA;
      if (ss.id === swappedB.id) return swappedB;
      return ss;
    });
    setSubgraphStepsByInput((prev) => ({ ...prev, [inputId]: updated }));

    // Persist both reordered steps
    await Promise.all([
      fetch(`/api/plans/${planId}/input-subgraph-steps`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: swappedA.id, stepNumber: swappedA.stepNumber }),
      }),
      fetch(`/api/plans/${planId}/input-subgraph-steps`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: swappedB.id, stepNumber: swappedB.stepNumber }),
      }),
    ]);
  }

  // ── Connection management ──────────────────────────────────────────────────

  async function openConnectDialog(outputId: string, stepId: string) {
    setConnectDialogOutputId(outputId);
    setConnectDialogStepId(stepId);
    setConnectTargetStepId("");
    setConnectTargetFlowChartId("");
    setConnectType("");
    setConnectError(null);
    const res = await fetch(`/api/plans/${planId}/process-steps?all=true`);
    if (res.ok) setAllStepsForPicker(await res.json());
  }

  function closeConnectDialog() {
    setConnectDialogOutputId(null);
    setConnectDialogStepId(null);
    setAllStepsForPicker([]);
    setConnectError(null);
  }

  async function createConnection() {
    if (!connectDialogOutputId || !connectDialogStepId || !connectTargetStepId || !connectTargetFlowChartId || !connectType) {
      setConnectError("Please select a target step and connection type.");
      return;
    }
    setConnectSaving(true);
    setConnectError(null);
    const res = await fetch(`/api/plans/${planId}/step-connections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceStepId: connectDialogStepId,
        sourceOutputId: connectDialogOutputId,
        targetStepId: connectTargetStepId,
        sourceFlowChartId: activeFlowChartId ?? "",
        targetFlowChartId: connectTargetFlowChartId,
        connectionType: connectType,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      setConnectError(err.error ?? "Failed to create connection.");
      setConnectSaving(false);
      return;
    }
    // Enrich and add to state
    const created = await res.json();
    const srcStep = steps.find((s) => s.id === connectDialogStepId);
    const srcOut = (outputsByStep[connectDialogStepId] ?? []).find((o) => o.id === connectDialogOutputId);
    const tgtStep = allStepsForPicker.find((s) => s.id === connectTargetStepId);
    const tgtChart = flowCharts.find((c) => c.id === connectTargetFlowChartId);
    // Build allSourceSteps: primary owner + any additional sources
    const additionalSources = outputSourcesByOutput[connectDialogOutputId] ?? [];
    const allSourceSteps: Array<{ stepName: string; stepNumber: number; stepLabel: string }> = [];
    if (srcStep) allSourceSteps.push({ stepName: srcStep.name, stepNumber: srcStep.sequence ?? srcStep.stepNumber, stepLabel: makeStepLabel(srcStep) });
    for (const s of additionalSources) {
      if (!allSourceSteps.find((x) => x.stepName === s.stepName)) {
        allSourceSteps.push({ stepName: s.stepName, stepNumber: s.stepNumber, stepLabel: s.stepLabel });
      }
    }

    const enriched: StepConnectionInfo = {
      ...created,
      sourceStepName: srcStep?.name ?? null,
      targetStepName: tgtStep?.name ?? null,
      sourceOutputName: srcOut?.name ?? null,
      sourceOutputType: srcOut?.outputType ?? outputTypeById[connectDialogOutputId] ?? null,
      sourceFlowChartName: flowCharts.find((c) => c.id === activeFlowChartId)?.name ?? null,
      targetFlowChartName: tgtChart?.name ?? null,
      allSourceSteps,
    };
    setConnectionsFromOutput((prev) => ({
      ...prev,
      [connectDialogOutputId]: [...(prev[connectDialogOutputId] ?? []), enriched],
    }));
    setConnectionsToStep((prev) => ({
      ...prev,
      [connectTargetStepId]: [...(prev[connectTargetStepId] ?? []), enriched],
    }));
    setConnectSaving(false);
    closeConnectDialog();
  }

  async function deleteOutput(outputId: string, outputName: string) {
    if (!confirm(`Delete output "${outputName}"? This will also remove all its hazard analysis data.`)) return;
    const res = await fetch(`/api/plans/${planId}/step-outputs?id=${outputId}`, { method: "DELETE" });
    if (!res.ok) return;
    setOutputsByStep((prev) => {
      const next: Record<string, StepOutput[]> = {};
      for (const [k, v] of Object.entries(prev)) {
        next[k] = v.filter((o) => o.id !== outputId);
      }
      return next;
    });
    // Also remove any connections that used this output
    setConnectionsFromOutput((prev) => {
      const next: Record<string, StepConnectionInfo[]> = { ...prev };
      delete next[outputId];
      return next;
    });
  }

  async function deleteConnection(connectionId: string) {
    if (!confirm("Remove this connection?")) return;
    const res = await fetch(`/api/plans/${planId}/step-connections?id=${connectionId}`, { method: "DELETE" });
    if (!res.ok) return;
    setConnectionsFromOutput((prev) => {
      const next: Record<string, StepConnectionInfo[]> = {};
      for (const [k, v] of Object.entries(prev)) {
        next[k] = v.filter((c) => c.id !== connectionId);
      }
      return next;
    });
    setConnectionsToStep((prev) => {
      const next: Record<string, StepConnectionInfo[]> = {};
      for (const [k, v] of Object.entries(prev)) {
        next[k] = v.filter((c) => c.id !== connectionId);
      }
      return next;
    });
  }

  // ── Output source management ───────────────────────────────────────────────

  function openLinkSourceDialog(outputId: string, ownerStepId: string) {
    setLinkSourceOutputId(outputId);
    setLinkSourceOwnerStepId(ownerStepId);
    setLinkSourceTargetStepId("");
    setLinkSourceError(null);
  }

  function closeLinkSourceDialog() {
    setLinkSourceOutputId(null);
    setLinkSourceOwnerStepId(null);
    setLinkSourceTargetStepId("");
    setLinkSourceError(null);
  }

  async function createOutputSource() {
    if (!linkSourceOutputId || !linkSourceTargetStepId) {
      setLinkSourceError("Please select a step.");
      return;
    }
    setLinkSourceSaving(true);
    setLinkSourceError(null);
    const res = await fetch(`/api/plans/${planId}/step-output-sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outputId: linkSourceOutputId, stepId: linkSourceTargetStepId }),
    });
    if (!res.ok) {
      const err = await res.json();
      setLinkSourceError(err.error ?? "Failed to link step.");
      setLinkSourceSaving(false);
      return;
    }
    const created = await res.json();
    const srcStep = steps.find((s) => s.id === linkSourceTargetStepId);

    // Add to outputSourcesByOutput
    setOutputSourcesByOutput((prev) => ({
      ...prev,
      [linkSourceOutputId]: [
        ...(prev[linkSourceOutputId] ?? []),
        { id: created.id, stepId: created.stepId, stepName: created.stepName, stepNumber: created.stepNumber, stepLabel: makeStepLabel({ sequence: created.stepNumber, stepNumber: created.stepNumber }) },
      ],
    }));

    // Add the output to the source step's outputsByStep
    const output = (outputsByStep[linkSourceOwnerStepId ?? ""] ?? []).find((o) => o.id === linkSourceOutputId);
    if (output && srcStep) {
      setOutputsByStep((prev) => {
        const existing = prev[linkSourceTargetStepId] ?? [];
        if (existing.find((o) => o.id === linkSourceOutputId)) return prev;
        return { ...prev, [linkSourceTargetStepId]: [...existing, output] };
      });
    }

    setLinkSourceSaving(false);
    closeLinkSourceDialog();
  }

  async function deleteOutputSource(sourceId: string, outputId: string, stepId: string) {
    if (!confirm("Remove this step as a source of this output?")) return;
    const res = await fetch(`/api/plans/${planId}/step-output-sources?id=${sourceId}`, { method: "DELETE" });
    if (!res.ok) return;
    setOutputSourcesByOutput((prev) => ({
      ...prev,
      [outputId]: (prev[outputId] ?? []).filter((s) => s.id !== sourceId),
    }));
    // Remove output from that step's outputsByStep
    setOutputsByStep((prev) => ({
      ...prev,
      [stepId]: (prev[stepId] ?? []).filter((o) => o.id !== outputId),
    }));
  }

  // ── Flow chart edit / delete ───────────────────────────────────────────────

  function openEditChart(chart: FlowChart) {
    setEditChartTarget(chart);
    setEditChartName(chart.name);
    setEditChartType(chart.flowChartType);
  }

  async function saveEditChart() {
    if (!editChartTarget || !editChartName.trim()) return;
    setSavingChart(true);
    const res = await fetch(`/api/plans/${planId}/flow-charts`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editChartTarget.id, name: editChartName.trim(), flowChartType: editChartType }),
    });
    if (res.ok) {
      const updated = await res.json();
      setFlowCharts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    }
    setSavingChart(false);
    setEditChartTarget(null);
  }

  async function deleteFlowChart(chartId: string) {
    if (!confirm("Delete this flow chart? All steps unique to it will be removed.")) return;
    const res = await fetch(`/api/plans/${planId}/flow-charts?id=${chartId}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? "Could not delete flow chart.");
      return;
    }
    const remaining = flowCharts.filter((c) => c.id !== chartId);
    setFlowCharts(remaining);
    if (chartId === activeFlowChartId && remaining.length > 0) {
      router.push(`/plans/${planId}/process-flow?chartId=${remaining[0].id}`);
    }
  }

  return (
    <div>
      {/* ── Flow chart tabs ───────────────────────────────────────────────── */}
      {flowCharts.length > 0 && (
        <div className="flex items-center gap-1 mb-5 border-b border-neutral-200 pb-0 overflow-x-auto">
          {flowCharts.map((chart) => {
            const isActive = chart.id === activeFlowChartId;
            return (
              <div key={chart.id} className="group/tab relative flex items-center">
                <button
                  onClick={() => router.push(`/plans/${planId}/process-flow?chartId=${chart.id}`)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    isActive
                      ? "border-neutral-900 text-neutral-900"
                      : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"
                  }`}
                >
                  <span>{FLOW_CHART_TYPE_LABELS[chart.flowChartType] ?? chart.flowChartType}</span>
                  <span className="text-neutral-400">·</span>
                  <span>{chart.name}</span>
                </button>
                {/* Edit / Delete icons — visible on hover */}
                <div className="absolute right-0 top-1 flex items-center gap-0.5 opacity-0 group-hover/tab:opacity-100 transition-opacity bg-white pl-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditChart(chart); }}
                    className="p-0.5 text-neutral-400 hover:text-neutral-700 rounded"
                    title="Edit flow chart"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  {flowCharts.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteFlowChart(chart.id); }}
                      className="p-0.5 text-neutral-400 hover:text-red-500 rounded"
                      title="Delete flow chart"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <button
            onClick={() => setShowNewChartDialog(true)}
            className="px-3 py-2 text-sm text-neutral-400 hover:text-neutral-700 border-b-2 border-transparent flex items-center gap-1 whitespace-nowrap"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
            </svg>
            New Flow Chart
          </button>
        </div>
      )}

      {/* ── New Flow Chart dialog ─────────────────────────────────────────── */}
      {showNewChartDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-[440px] overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="text-base font-semibold">New Flow Chart</h3>
              <button onClick={() => setShowNewChartDialog(false)} className="text-neutral-400 hover:text-neutral-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-700 block mb-1">Flow Chart Name *</label>
                <Input
                  value={newChartName}
                  onChange={(e) => setNewChartName(e.target.value)}
                  placeholder="e.g. Washing Sub-Process"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") createFlowChart(); }}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-700 block mb-1">Type</label>
                <Select value={newChartType} onValueChange={(v) => v && setNewChartType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main_process">Main Process</SelectItem>
                    <SelectItem value="byproduct">By-Product Stream</SelectItem>
                    <SelectItem value="incoming_ingredient">Incoming Ingredient</SelectItem>
                    <SelectItem value="waste_stream">Waste Stream</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-700 block mb-1">Description</label>
                <Input
                  value={newChartDesc}
                  onChange={(e) => setNewChartDesc(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <Button onClick={createFlowChart} disabled={creatingChart || !newChartName.trim()}>
                {creatingChart ? "Creating…" : "Create Flow Chart"}
              </Button>
              <Button variant="ghost" onClick={() => setShowNewChartDialog(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Flow Chart dialog ───────────────────────────────────────── */}
      {editChartTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-[440px] overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="text-base font-semibold">Edit Flow Chart</h3>
              <button onClick={() => setEditChartTarget(null)} className="text-neutral-400 hover:text-neutral-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-700 block mb-1">Name *</label>
                <Input
                  value={editChartName}
                  onChange={(e) => setEditChartName(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") saveEditChart(); }}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-700 block mb-1">Type</label>
                <Select value={editChartType} onValueChange={(v) => v && setEditChartType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main_process">Main Process</SelectItem>
                    <SelectItem value="byproduct">By-Product Stream</SelectItem>
                    <SelectItem value="incoming_ingredient">Incoming Ingredient</SelectItem>
                    <SelectItem value="waste_stream">Waste Stream</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <Button onClick={saveEditChart} disabled={savingChart || !editChartName.trim()} size="sm">
                {savingChart ? "Saving…" : "Save"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditChartTarget(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Connection dialog ─────────────────────────────────────── */}
      {connectDialogOutputId && connectDialogStepId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-[520px] max-h-[80vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Connect Output to Step</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Output: <span className="font-medium text-neutral-700">
                    {(outputsByStep[connectDialogStepId] ?? []).find((o) => o.id === connectDialogOutputId)?.name ?? connectDialogOutputId}
                  </span>
                </p>
              </div>
              <button onClick={closeConnectDialog} className="text-neutral-400 hover:text-neutral-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Step picker */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              <p className="text-xs font-medium text-neutral-600 mb-2">Select target step:</p>
              {(() => {
                // Group by flow chart
                const byChart = new Map<string, { chartName: string; steps: StepForPicker[] }>();
                for (const s of allStepsForPicker) {
                  if (s.id === connectDialogStepId) continue; // exclude source step
                  const key = s.flowChartId ?? "__none__";
                  if (!byChart.has(key)) {
                    byChart.set(key, { chartName: s.flowChartName ?? "Unassigned", steps: [] });
                  }
                  byChart.get(key)!.steps.push(s);
                }
                if (byChart.size === 0) {
                  return <p className="text-sm text-neutral-400 text-center py-6">No other steps available.</p>;
                }
                return [...byChart.entries()].map(([chartId, group]) => (
                  <div key={chartId} className="mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 mb-1 px-1">
                      {group.chartName}
                      {chartId === activeFlowChartId && (
                        <span className="ml-1.5 text-[9px] normal-case font-medium bg-neutral-100 text-neutral-500 px-1 rounded">current</span>
                      )}
                    </p>
                    {group.steps.map((s) => (
                      <button
                        key={`${s.id}-${chartId}`}
                        onClick={() => {
                          setConnectTargetStepId(s.id);
                          setConnectTargetFlowChartId(chartId === "__none__" ? (activeFlowChartId ?? "") : chartId);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg mb-0.5 flex items-center gap-2 border transition-colors text-sm ${
                          connectTargetStepId === s.id && (connectTargetFlowChartId === chartId || (chartId === "__none__" && connectTargetFlowChartId === activeFlowChartId))
                            ? "border-neutral-900 bg-neutral-50"
                            : "border-transparent hover:border-neutral-200 hover:bg-neutral-50"
                        }`}
                      >
                        <span className="w-6 h-6 rounded-full border border-neutral-200 bg-white flex items-center justify-center text-[10px] font-bold text-neutral-600 shrink-0">
                          {s.sequence ?? s.stepNumber}
                        </span>
                        <span className="font-medium text-neutral-800 truncate flex-1">{s.name}</span>
                        {s.isCcp && (
                          <span className="shrink-0 text-[9px] font-bold bg-red-100 text-red-700 px-1 rounded">{s.ccpNumber || "CCP"}</span>
                        )}
                      </button>
                    ))}
                  </div>
                ));
              })()}
            </div>

            {/* Connection type + error + actions */}
            <div className="px-5 py-4 border-t space-y-3">
              <div>
                <label className="text-xs font-medium text-neutral-700 block mb-1">Connection type *</label>
                <Select value={connectType} onValueChange={(v) => v && setConnectType(v as "direct" | "reference")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Direct — output physically moves to next step</SelectItem>
                    <SelectItem value="reference">Reference — shared/linked, operates independently</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {connectError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{connectError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={createConnection}
                  disabled={connectSaving || !connectTargetStepId || !connectTargetFlowChartId || !connectType}
                  size="sm"
                >
                  {connectSaving ? "Connecting…" : "Create Connection"}
                </Button>
                <Button variant="ghost" size="sm" onClick={closeConnectDialog}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">
            {flowCharts.find((c) => c.id === activeFlowChartId)?.name ?? "Process Flow Diagram"}
          </h2>
          <p className="text-sm text-neutral-500">
            Drag to reorder. Click a step to open hazard analysis. Hover a step to add inputs.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs text-neutral-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border-2 border-red-400 bg-red-50" /> CCP
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm border-2 border-neutral-300 bg-white" /> Step
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-violet-100 border border-violet-300" /> Shared
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-teal-100 border border-teal-300" /> Output
            </span>
          </div>
          {/* Link existing step button */}
          <Button variant="outline" size="sm" onClick={() => { setShowLinkDialog(true); searchLinkableSteps(""); }}>
            <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Link Shared Step
          </Button>
        </div>
      </div>

      {/* ── Link Step dialog ──────────────────────────────────────────────── */}
      {showLinkDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-[520px] max-h-[80vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Link Shared Step</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Add an existing step from any plan. Hazards &amp; controls always stay with the master step.
                </p>
              </div>
              <button onClick={() => { setShowLinkDialog(false); setLinkResults([]); setLinkSearch(""); }} className="text-neutral-400 hover:text-neutral-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 border-b">
              <input
                type="text"
                placeholder="Search by step name or plan…"
                value={linkSearch}
                onChange={(e) => { setLinkSearch(e.target.value); searchLinkableSteps(e.target.value); }}
                className="w-full text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {linkResults.length === 0 ? (
                <p className="text-sm text-neutral-400 text-center py-8">
                  {linkSearch ? "No matching steps found." : "Search for a step to link."}
                </p>
              ) : (
                linkResults.map((step) => (
                  <button
                    key={step.id}
                    onClick={() => linkStep(step.id)}
                    disabled={linking}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-neutral-50 flex items-start gap-3 disabled:opacity-50 border border-transparent hover:border-neutral-200 mb-1"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900">{step.name}</p>
                      {step.description && (
                        <p className="text-xs text-neutral-500 truncate">{step.description}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] text-neutral-400 font-medium">{step.homePlanName}</p>
                      {step.isSharedMaster && (
                        <span className="text-[10px] text-violet-600 font-semibold">Shared</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Local Overrides dialog ────────────────────────────────────────── */}
      {overrideTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-[440px] overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h3 className="text-base font-semibold">Local Overrides</h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Override display name and description for this flow chart only.
                Hazards and controls always follow the master step.
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-700 block mb-1">
                  Name
                  <span className="ml-1 text-neutral-400 font-normal">(master: {overrideTarget.masterName})</span>
                </label>
                <input
                  type="text"
                  value={overrideName}
                  onChange={(e) => setOverrideName(e.target.value)}
                  placeholder={overrideTarget.masterName ?? ""}
                  className="w-full text-sm border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-700 block mb-1">Description</label>
                <textarea
                  value={overrideDesc}
                  onChange={(e) => setOverrideDesc(e.target.value)}
                  placeholder={overrideTarget.masterDescription ?? ""}
                  rows={2}
                  className="w-full text-sm border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-neutral-400 resize-none"
                />
              </div>
            </div>
            <div className="px-5 pb-5 flex items-center gap-2">
              <Button onClick={saveOverride} disabled={savingOverride} size="sm">
                {savingOverride ? "Saving…" : "Save Override"}
              </Button>
              {(overrideTarget.localOverrides?.name || overrideTarget.localOverrides?.description) && (
                <Button variant="outline" size="sm" onClick={() => { clearOverride(overrideTarget); setOverrideTarget(null); }}>
                  Clear Override
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setOverrideTarget(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Link Step as Output Source dialog ───────────────────────────── */}
      {linkSourceOutputId && linkSourceOwnerStepId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-[480px] max-h-[70vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Link Step as Output Source</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Output: <span className="font-medium text-neutral-700">
                    {(outputsByStep[linkSourceOwnerStepId] ?? []).find((o) => o.id === linkSourceOutputId)?.name ?? linkSourceOutputId}
                  </span>
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">Select a step that also produces this output.</p>
              </div>
              <button onClick={closeLinkSourceDialog} className="text-neutral-400 hover:text-neutral-700">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3">
              <p className="text-xs font-medium text-neutral-600 mb-2">Select step:</p>
              {steps
                .filter((s) => {
                  if (s.id === linkSourceOwnerStepId) return false;
                  const already = (outputSourcesByOutput[linkSourceOutputId] ?? []).some((src) => src.stepId === s.id);
                  return !already;
                })
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setLinkSourceTargetStepId(s.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg mb-0.5 flex items-center gap-2 border transition-colors text-sm ${
                      linkSourceTargetStepId === s.id
                        ? "border-neutral-900 bg-neutral-50"
                        : "border-transparent hover:border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    <span className="w-6 h-6 rounded-full border border-neutral-200 bg-white flex items-center justify-center text-[10px] font-bold text-neutral-600 shrink-0">
                      {s.sequence ?? s.stepNumber}
                    </span>
                    <span className="font-medium text-neutral-800 truncate flex-1">{s.name}</span>
                  </button>
                ))}
              {steps.filter((s) => s.id !== linkSourceOwnerStepId && !(outputSourcesByOutput[linkSourceOutputId] ?? []).some((src) => src.stepId === s.id)).length === 0 && (
                <p className="text-sm text-neutral-400 text-center py-4">All steps in this chart are already linked.</p>
              )}
            </div>
            <div className="px-5 py-4 border-t space-y-2">
              {linkSourceError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{linkSourceError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={createOutputSource}
                  disabled={linkSourceSaving || !linkSourceTargetStepId}
                  size="sm"
                >
                  {linkSourceSaving ? "Linking…" : "Link Step"}
                </Button>
                <Button variant="ghost" size="sm" onClick={closeLinkSourceDialog}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/*
        Layout: [inputs: w-52] [left arrow: w-12] [step box: flex-1] [right arrow: w-12] [outputs: w-52]
        The w-52 + w-12 = w-64 left offset and matching right spacer keep vertical arrows
        and the "Add step" control centered under the step box column.
      */}
      <div className="flex flex-col w-full max-w-6xl mx-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={steps.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {steps.map((step, index) => (
              <div key={step.id} className="flex flex-col w-full">
                <FlowNode
                  step={step}
                  hazardCount={hazardCounts[step.id] || 0}
                  hazardTypes={hazardTypesByStep[step.id] || []}
                  isShared={!!(step.isShared || step.isSharedMaster)}
                  hasLocalOverride={!!(step.localOverrides?.name || step.localOverrides?.description)}
                  onOverride={() => openOverrideEditor(step)}
                  onDelete={() => deleteStep(step.id)}
                  onDuplicate={() => duplicateStep(step.id)}
                  onRename={(name) => renameStep(step.id, name)}
                  inputs={inputsByStep[step.id] || []}
                  subgraphStepsByInput={subgraphStepsByInput}
                  onAddInput={(name, type) => addInput(step.id, name, type)}
                  onDeleteInput={(inputId) => deleteInput(step.id, inputId)}
                  onAddSubgraphStep={(inputId, name, category) => addSubgraphStep(inputId, name, category)}
                  onDeleteSubgraphStep={(inputId, ssId) => deleteSubgraphStep(inputId, ssId)}
                  onMoveSubgraphStep={(inputId, ssId, dir) => moveSubgraphStep(inputId, ssId, dir)}
                  hazardTypesBySubgraphStep={hazardTypesBySubgraphStep}
                  outputs={(() => {
                    const direct = (outputsByStep ?? {})[step.id] ?? [];
                    const directIds = new Set(direct.map((o) => o.id));
                    const shared = (sharedOutputsByStep[step.id] ?? []).filter(
                      (o) => !directIds.has(o.id),
                    );
                    return [...direct, ...shared];
                  })()}
                  hazardTypesByOutput={hazardTypesByOutput}
                  connectionsFromOutput={connectionsFromOutput}
                  connectionsToStep={derivedConnectionsToStep[step.id] ?? []}
                  activeFlowChartId={activeFlowChartId ?? ""}
                  planId={planId}
                  onConnect={openConnectDialog}
                  onDeleteConnection={deleteConnection}
                  onDeleteOutput={deleteOutput}
                  outputSourcesByOutput={outputSourcesByOutput}
                  allProducingStepsByOutput={allProducingStepsByOutput}
                  chartLetter={activeChartLetter}
                  primaryOutputStepId={step.id}
                  onLinkOutputSource={(outputId) => openLinkSourceDialog(outputId, step.id)}
                  onDeleteOutputSource={deleteOutputSource}
                />
                {/* Arrow connector — centered under the step box */}
                {index < steps.length - 1 && (
                  <div className="flex py-0.5">
                    <div className="w-64 shrink-0" />
                    <div className="flex-1 flex flex-col items-center">
                      <div className="w-px h-6 bg-neutral-300" />
                      <svg width="12" height="8" viewBox="0 0 12 8" className="text-neutral-300">
                        <path d="M6 8L0 0h12z" fill="currentColor" />
                      </svg>
                    </div>
                    <div className="w-64 shrink-0" />
                  </div>
                )}
              </div>
            ))}
          </SortableContext>
        </DndContext>

        {/* Terminal / Add step — centered under step box */}
        <div className="mt-2 flex">
          <div className="w-64 shrink-0" />
          <div className="flex-1 flex flex-col items-center">
            <div className="w-px h-4 bg-neutral-200" />
            {showAddForm ? (
              <div className="border-2 border-dashed border-neutral-300 rounded-lg p-4 w-full mt-1">
                <div className="flex gap-2">
                  <Input
                    placeholder="Step name..."
                    value={newStepName}
                    onChange={(e) => setNewStepName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addStep()}
                    autoFocus
                    className="flex-1"
                  />
                  <Select value={newStepCategory} onValueChange={(v) => v && setNewStepCategory(v)}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receiving">Receiving</SelectItem>
                      <SelectItem value="storage">Storage</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="packaging">Packaging</SelectItem>
                      <SelectItem value="shipping">Shipping</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button onClick={addStep} disabled={adding || !newStepName.trim()} size="sm">
                    Add Step
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-1 w-10 h-10 rounded-full border-2 border-dashed border-neutral-300 flex items-center justify-center text-neutral-400 hover:border-neutral-400 hover:text-neutral-600 transition-colors"
                title="Add process step"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
                </svg>
              </button>
            )}
          </div>
          <div className="w-64 shrink-0" />
        </div>
      </div>
    </div>
  );
}
