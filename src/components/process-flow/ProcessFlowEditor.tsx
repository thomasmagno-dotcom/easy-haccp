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

interface Props {
  planId: string;
  initialSteps: ProcessStep[];
  hazardCounts: Record<string, number>;
}

export function ProcessFlowEditor({
  planId,
  initialSteps,
  hazardCounts,
}: Props) {
  const [steps, setSteps] = useState(initialSteps);
  const [newStepName, setNewStepName] = useState("");
  const [newStepCategory, setNewStepCategory] = useState("processing");
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(steps, oldIndex, newIndex).map((s, i) => ({
      ...s,
      stepNumber: i + 1,
    }));

    const previousSteps = steps;
    setSteps(reordered); // Optimistic — respond to drag instantly

    const res = await fetch(`/api/plans/${planId}/process-steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reorder",
        stepIds: reordered.map((s) => s.id),
      }),
    });

    if (!res.ok) {
      setSteps(previousSteps); // Revert on failure
    }
  }

  async function addStep() {
    if (!newStepName.trim()) return;
    setAdding(true);

    const res = await fetch(`/api/plans/${planId}/process-steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newStepName.trim(),
        category: newStepCategory,
      }),
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
    const res = await fetch(
      `/api/plans/${planId}/process-steps?stepId=${stepId}`,
      { method: "DELETE" },
    );

    if (res.ok) {
      setSteps((prev) =>
        prev
          .filter((s) => s.id !== stepId)
          .map((s, i) => ({ ...s, stepNumber: i + 1 })),
      );
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Process Flow Diagram</h2>
          <p className="text-sm text-neutral-500">
            Drag to reorder. Click a step to open hazard analysis.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border-2 border-red-400 bg-red-50" />
            CCP
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border-2 border-neutral-300 bg-white" />
            Process Step
          </span>
        </div>
      </div>

      {/* Flow Diagram */}
      <div className="flex flex-col items-center">
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
              <div key={step.id} className="flex flex-col items-center w-full max-w-lg">
                <FlowNode
                  step={step}
                  hazardCount={hazardCounts[step.id] || 0}
                  planId={planId}
                  onDelete={() => deleteStep(step.id)}
                />
                {/* Arrow connector */}
                {index < steps.length - 1 && (
                  <div className="flex flex-col items-center py-0.5">
                    <div className="w-px h-6 bg-neutral-300" />
                    <svg
                      width="12"
                      height="8"
                      viewBox="0 0 12 8"
                      className="text-neutral-300"
                    >
                      <path d="M6 8L0 0h12z" fill="currentColor" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </SortableContext>
        </DndContext>

        {/* Terminal / Add step */}
        <div className="mt-2 flex flex-col items-center">
          <div className="w-px h-4 bg-neutral-200" />
          {showAddForm ? (
            <div className="border-2 border-dashed border-neutral-300 rounded-lg p-4 w-full max-w-lg mt-1">
              <div className="flex gap-2">
                <Input
                  placeholder="Step name..."
                  value={newStepName}
                  onChange={(e) => setNewStepName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addStep()}
                  autoFocus
                  className="flex-1"
                />
                <Select
                  value={newStepCategory}
                  onValueChange={(v) => v && setNewStepCategory(v)}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
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
  );
}
