"use client";

import { useState } from "react";
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
  sourceFlowChartName: string | null;
  targetFlowChartName: string | null;
  sourceFlowChartId: string;
  targetFlowChartId: string;
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
  initialOutputsByStep?: Record<string, StepOutput[]>;
  hazardTypesByOutput?: Record<string, string[]>;
  connectionsFromOutput?: Record<string, StepConnectionInfo[]>;
  connectionsToStep?: Record<string, StepConnectionInfo[]>;
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
  initialOutputsByStep,
  hazardTypesByOutput = {},
  connectionsFromOutput = {},
  connectionsToStep = {},
}: Props) {
  const [steps, setSteps] = useState(initialSteps);
  const [inputsByStep, setInputsByStep] = useState<Record<string, StepInput[]>>(initialInputs);
  const [subgraphStepsByInput, setSubgraphStepsByInput] = useState<Record<string, SubgraphStep[]>>(initialSubgraphSteps);
  const [outputsByStep, setOutputsByStep] = useState<Record<string, StepOutput[]>>(initialOutputsByStep ?? {});
  const [newStepName, setNewStepName] = useState("");
  const [newStepCategory, setNewStepCategory] = useState("processing");
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  // Flow chart management
  const [flowCharts, setFlowCharts] = useState(initialFlowCharts);
  const [showNewChartDialog, setShowNewChartDialog] = useState(false);
  const [newChartName, setNewChartName] = useState("");
  const [newChartType, setNewChartType] = useState("main_process");
  const [newChartDesc, setNewChartDesc] = useState("");
  const [creatingChart, setCreatingChart] = useState(false);
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

    const res = await fetch(`/api/plans/${planId}/process-steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reorder", stepIds: reordered.map((s) => s.id) }),
    });
    if (!res.ok) setSteps(previousSteps);
  }

  async function addStep() {
    if (!newStepName.trim()) return;
    setAdding(true);
    const res = await fetch(`/api/plans/${planId}/process-steps`, {
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
    const res = await fetch(`/api/plans/${planId}/process-steps?stepId=${stepId}`, { method: "DELETE" });
    if (res.ok) {
      setSteps((prev) => prev.filter((s) => s.id !== stepId).map((s, i) => ({ ...s, stepNumber: i + 1 })));
      setInputsByStep((prev) => { const next = { ...prev }; delete next[stepId]; return next; });
      setOutputsByStep((prev) => { const next = { ...prev }; delete next[stepId]; return next; });
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

  return (
    <div>
      {/* ── Flow chart tabs ───────────────────────────────────────────────── */}
      {flowCharts.length > 0 && (
        <div className="flex items-center gap-1 mb-5 border-b border-neutral-200 pb-0 overflow-x-auto">
          {flowCharts.map((chart) => {
            const isActive = chart.id === activeFlowChartId;
            return (
              <button
                key={chart.id}
                onClick={() => router.push(`/plans/${planId}/process-flow?chartId=${chart.id}`)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? "border-neutral-900 text-neutral-900"
                    : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"
                }`}
              >
                <span>{FLOW_CHART_TYPE_LABELS[chart.flowChartType] ?? chart.flowChartType}</span>
                <span className="text-neutral-500">·</span>
                <span>{chart.name}</span>
              </button>
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
                  inputs={inputsByStep[step.id] || []}
                  subgraphStepsByInput={subgraphStepsByInput}
                  onAddInput={(name, type) => addInput(step.id, name, type)}
                  onDeleteInput={(inputId) => deleteInput(step.id, inputId)}
                  onAddSubgraphStep={(inputId, name, category) => addSubgraphStep(inputId, name, category)}
                  onDeleteSubgraphStep={(inputId, ssId) => deleteSubgraphStep(inputId, ssId)}
                  onMoveSubgraphStep={(inputId, ssId, dir) => moveSubgraphStep(inputId, ssId, dir)}
                  outputs={(outputsByStep ?? {})[step.id] ?? []}
                  hazardTypesByOutput={hazardTypesByOutput}
                  connectionsFromOutput={connectionsFromOutput}
                  connectionsToStep={connectionsToStep[step.id] ?? []}
                  activeFlowChartId={activeFlowChartId ?? ""}
                  planId={planId}
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
