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

interface Props {
  planId: string;
  initialSteps: ProcessStep[];
  hazardCounts: Record<string, number>;
  initialInputs: Record<string, StepInput[]>;
  initialSubgraphSteps: Record<string, SubgraphStep[]>;
}

export function ProcessFlowEditor({
  planId,
  initialSteps,
  hazardCounts,
  initialInputs,
  initialSubgraphSteps,
}: Props) {
  const [steps, setSteps] = useState(initialSteps);
  const [inputsByStep, setInputsByStep] = useState<Record<string, StepInput[]>>(initialInputs);
  const [subgraphStepsByInput, setSubgraphStepsByInput] = useState<Record<string, SubgraphStep[]>>(initialSubgraphSteps);
  const [newStepName, setNewStepName] = useState("");
  const [newStepCategory, setNewStepCategory] = useState("processing");
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Process Flow Diagram</h2>
          <p className="text-sm text-neutral-500">
            Drag to reorder. Click a step to open hazard analysis. Hover a step to add inputs. Click "+ Add step to flow" inside an input to define its handling sub-flow.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border-2 border-red-400 bg-red-50" /> CCP
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border-2 border-neutral-300 bg-white" /> Process Step
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-green-100 border border-green-300" /> Input subgraph
          </span>
        </div>
      </div>

      {/*
        Layout: each row = [input subgraphs: w-52] [connector: w-12] [step box: flex-1]
        The w-52 + w-12 = 256px (w-64) left offset is replicated on the vertical arrows
        and the "Add step" control so they align under the step box column.
      */}
      <div className="flex flex-col w-full max-w-4xl mx-auto">
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
                  planId={planId}
                  onDelete={() => deleteStep(step.id)}
                  inputs={inputsByStep[step.id] || []}
                  subgraphStepsByInput={subgraphStepsByInput}
                  onAddInput={(name, type) => addInput(step.id, name, type)}
                  onDeleteInput={(inputId) => deleteInput(step.id, inputId)}
                  onAddSubgraphStep={(inputId, name, category) => addSubgraphStep(inputId, name, category)}
                  onDeleteSubgraphStep={(inputId, ssId) => deleteSubgraphStep(inputId, ssId)}
                  onMoveSubgraphStep={(inputId, ssId, dir) => moveSubgraphStep(inputId, ssId, dir)}
                />
                {/* Arrow connector — offset to align under the step box */}
                {index < steps.length - 1 && (
                  <div className="flex py-0.5">
                    <div className="w-64 shrink-0" />
                    <div className="flex-1 flex flex-col items-center">
                      <div className="w-px h-6 bg-neutral-300" />
                      <svg width="12" height="8" viewBox="0 0 12 8" className="text-neutral-300">
                        <path d="M6 8L0 0h12z" fill="currentColor" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </SortableContext>
        </DndContext>

        {/* Terminal / Add step — offset to align under step box */}
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
        </div>
      </div>
    </div>
  );
}
