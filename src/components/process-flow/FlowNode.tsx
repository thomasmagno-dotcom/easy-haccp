"use client";

import { useState, useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProcessStep {
  id: string;
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
  step: ProcessStep;
  hazardCount: number;
  planId: string;
  onDelete: () => void;
  inputs: StepInput[];
  subgraphStepsByInput: Record<string, SubgraphStep[]>;
  onAddInput: (name: string, type: string) => void;
  onDeleteInput: (inputId: string) => void;
  onAddSubgraphStep: (inputId: string, name: string, category: string) => void;
  onDeleteSubgraphStep: (inputId: string, subgraphStepId: string) => void;
  onMoveSubgraphStep: (inputId: string, subgraphStepId: string, direction: "up" | "down") => void;
}

// ── Style config ──────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  receiving: "📥", storage: "🧊", processing: "⚙️", packaging: "📦", shipping: "🚛",
};

const CATEGORY_BG: Record<string, string> = {
  receiving:  "from-blue-50 to-blue-100/50 border-blue-200",
  storage:    "from-cyan-50 to-cyan-100/50 border-cyan-200",
  processing: "from-amber-50 to-amber-100/50 border-amber-200",
  packaging:  "from-green-50 to-green-100/50 border-green-200",
  shipping:   "from-purple-50 to-purple-100/50 border-purple-200",
};

const CCP_STYLE = "from-red-50 to-red-100/60 border-red-300 ring-2 ring-red-200/50";

const INPUT_TYPE_CONFIG: Record<string, { border: string; header: string; icon: string; label: string }> = {
  water:    { border: "border-blue-200",    header: "bg-blue-100 text-blue-700",     icon: "💧", label: "Water"    },
  chemical: { border: "border-orange-200",  header: "bg-orange-100 text-orange-700", icon: "⚗️", label: "Chemical" },
  material: { border: "border-green-200",   header: "bg-green-100 text-green-700",   icon: "📦", label: "Material" },
  energy:   { border: "border-yellow-200",  header: "bg-yellow-100 text-yellow-700", icon: "⚡", label: "Energy"   },
  other:    { border: "border-neutral-200", header: "bg-neutral-100 text-neutral-600",icon: "◦", label: "Other"    },
};

const SUBSTEP_CATEGORY_CONFIG: Record<string, { icon: string; label: string; bg: string }> = {
  receiving:  { icon: "📥", label: "Receiving",  bg: "bg-blue-50 border-blue-200"     },
  storage:    { icon: "🧊", label: "Storage",    bg: "bg-cyan-50 border-cyan-200"     },
  inspection: { icon: "🔍", label: "Inspection", bg: "bg-purple-50 border-purple-200" },
  processing: { icon: "⚙️", label: "Processing", bg: "bg-amber-50 border-amber-200"   },
  transport:  { icon: "🚚", label: "Transport",  bg: "bg-neutral-50 border-neutral-200"},
  other:      { icon: "▪",  label: "Other",      bg: "bg-neutral-50 border-neutral-200"},
};

const INPUT_TYPE_ORDER = ["water", "chemical", "material", "energy", "other"];

// ── SubgraphStepRow ───────────────────────────────────────────────────────────

function SubgraphStepRow({
  ss, isFirst, isLast, onDelete, onMoveUp, onMoveDown,
}: {
  ss: SubgraphStep;
  isFirst: boolean;
  isLast: boolean;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const cfg = SUBSTEP_CATEGORY_CONFIG[ss.category ?? "other"] ?? SUBSTEP_CATEGORY_CONFIG.other;

  return (
    <div className="group/ss flex flex-col items-center w-full">
      <div className={cn("w-full flex items-center gap-1.5 rounded-md border px-2 py-1.5", cfg.bg)}>
        {/* Step number */}
        <span className="w-4 h-4 rounded-full bg-white border border-neutral-300 flex items-center justify-center text-[9px] font-bold text-neutral-600 shrink-0">
          {ss.stepNumber}
        </span>
        <span className="text-[10px]">{cfg.icon}</span>
        <span className="text-xs text-neutral-700 font-medium flex-1 truncate">{ss.name}</span>

        {/* Reorder + delete (on hover) */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover/ss:opacity-100 transition-opacity shrink-0">
          <button onClick={onMoveUp} disabled={isFirst}
            className="w-4 h-4 flex items-center justify-center text-neutral-400 hover:text-neutral-700 disabled:opacity-20"
            title="Move up">
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button onClick={onMoveDown} disabled={isLast}
            className="w-4 h-4 flex items-center justify-center text-neutral-400 hover:text-neutral-700 disabled:opacity-20"
            title="Move down">
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button onClick={onDelete}
            className="w-4 h-4 flex items-center justify-center text-neutral-300 hover:text-red-400"
            title="Delete step">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Down-arrow connector between sub-steps */}
      {!isLast && (
        <div className="flex flex-col items-center py-0.5">
          <div className="w-px h-3 bg-neutral-300" />
          <svg width="8" height="5" viewBox="0 0 8 5" className="text-neutral-300">
            <path d="M4 5L0 0h8z" fill="currentColor" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ── InputSubgraphBox ──────────────────────────────────────────────────────────

function InputSubgraphBox({
  input, subSteps, onDeleteInput, onAddSubStep, onDeleteSubStep, onMoveSubStep,
}: {
  input: StepInput;
  subSteps: SubgraphStep[];
  onDeleteInput: () => void;
  onAddSubStep: (name: string, category: string) => void;
  onDeleteSubStep: (subStepId: string) => void;
  onMoveSubStep: (subStepId: string, direction: "up" | "down") => void;
}) {
  const [showStepForm, setShowStepForm] = useState(false);
  const [newStepName, setNewStepName] = useState("");
  const [newStepCategory, setNewStepCategory] = useState("receiving");

  const cfg = INPUT_TYPE_CONFIG[input.type ?? "other"] ?? INPUT_TYPE_CONFIG.other;
  const sorted = [...subSteps].sort((a, b) => a.stepNumber - b.stepNumber);

  function submitStep() {
    if (newStepName.trim()) {
      onAddSubStep(newStepName.trim(), newStepCategory);
      setNewStepName("");
      setShowStepForm(false);
    }
  }

  return (
    <div className={cn("rounded-lg border-2 overflow-hidden shadow-sm", cfg.border)}>
      {/* Type header */}
      <div className={cn("px-2 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center justify-between", cfg.header)}>
        <span className="flex items-center gap-1">
          <span>{cfg.icon}</span>
          <span>{cfg.label}</span>
        </span>
        <button onClick={onDeleteInput} className="opacity-50 hover:opacity-100 transition-opacity" title="Remove input">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="bg-white px-2 py-2 flex flex-col gap-1.5">
        {/* Input name */}
        <p className="text-xs font-semibold text-neutral-700 truncate leading-tight">{input.name}</p>

        {/* Sub-flow steps */}
        {sorted.length > 0 && (
          <div className="mt-1 flex flex-col">
            <div className="flex flex-col items-center mb-0.5">
              <div className="w-px h-2 bg-neutral-200" />
            </div>
            {sorted.map((ss, idx) => (
              <SubgraphStepRow
                key={ss.id}
                ss={ss}
                isFirst={idx === 0}
                isLast={idx === sorted.length - 1}
                onDelete={() => onDeleteSubStep(ss.id)}
                onMoveUp={() => onMoveSubStep(ss.id, "up")}
                onMoveDown={() => onMoveSubStep(ss.id, "down")}
              />
            ))}
          </div>
        )}

        {/* Add step to sub-flow */}
        <div className="mt-0.5">
          {showStepForm ? (
            <div className="rounded border border-dashed border-neutral-300 p-1.5 flex flex-col gap-1 bg-neutral-50">
              <input
                type="text"
                placeholder="Step name…"
                value={newStepName}
                onChange={(e) => setNewStepName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitStep();
                  if (e.key === "Escape") { setShowStepForm(false); setNewStepName(""); }
                }}
                className="text-xs border rounded px-1.5 py-1 w-full focus:outline-none focus:ring-1 focus:ring-neutral-400"
                autoFocus
              />
              <div className="flex items-center gap-1">
                <select
                  value={newStepCategory}
                  onChange={(e) => setNewStepCategory(e.target.value)}
                  className="text-xs border rounded px-1 py-0.5 bg-white flex-1"
                >
                  {Object.entries(SUBSTEP_CATEGORY_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
                <button onClick={submitStep}
                  className="text-xs text-green-600 hover:text-green-800 font-semibold px-1.5 py-0.5 rounded hover:bg-green-50">✓</button>
                <button onClick={() => { setShowStepForm(false); setNewStepName(""); }}
                  className="text-xs text-neutral-400 hover:text-neutral-600 px-1 py-0.5">✕</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowStepForm(true)}
              className="text-[11px] text-neutral-400 hover:text-neutral-700 flex items-center gap-0.5 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
              </svg>
              Add step to flow
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── FlowNode ──────────────────────────────────────────────────────────────────

export function FlowNode({
  step, hazardCount, planId, onDelete,
  inputs, subgraphStepsByInput,
  onAddInput, onDeleteInput,
  onAddSubgraphStep, onDeleteSubgraphStep, onMoveSubgraphStep,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  const [showInputForm, setShowInputForm] = useState(false);
  const [newInputName, setNewInputName] = useState("");
  const [newInputType, setNewInputType] = useState("water");

  const style = { transform: CSS.Transform.toString(transform), transition };

  const bgClass = step.isCcp
    ? CCP_STYLE
    : CATEGORY_BG[step.category || ""] || "from-neutral-50 to-neutral-100/50 border-neutral-200";

  // Group inputs by type in canonical order
  const groupedInputs = useMemo(() => {
    const map: Record<string, StepInput[]> = {};
    for (const inp of inputs) {
      const t = inp.type || "other";
      if (!map[t]) map[t] = [];
      map[t].push(inp);
    }
    const ordered = INPUT_TYPE_ORDER.filter((t) => map[t]?.length).map((t) => map[t]);
    for (const t of Object.keys(map)) {
      if (!INPUT_TYPE_ORDER.includes(t)) ordered.push(map[t]);
    }
    return ordered.flat();
  }, [inputs]);

  function submitInput() {
    if (newInputName.trim()) {
      onAddInput(newInputName.trim(), newInputType);
      setNewInputName("");
      setShowInputForm(false);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("flex items-center w-full group", isDragging && "z-50 opacity-90")}
    >
      {/* ── Left zone: input subgraphs ────────────────────────────────── */}
      <div className="w-52 shrink-0 flex flex-col gap-2 pr-2 self-stretch justify-center">

        {groupedInputs.map((inp) => (
          <InputSubgraphBox
            key={inp.id}
            input={inp}
            subSteps={subgraphStepsByInput[inp.id] || []}
            onDeleteInput={() => onDeleteInput(inp.id)}
            onAddSubStep={(name, cat) => onAddSubgraphStep(inp.id, name, cat)}
            onDeleteSubStep={(ssId) => onDeleteSubgraphStep(inp.id, ssId)}
            onMoveSubStep={(ssId, dir) => onMoveSubgraphStep(inp.id, ssId, dir)}
          />
        ))}

        {/* Add input form / button */}
        <div className={cn("transition-opacity", showInputForm ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
          {showInputForm ? (
            <div className="rounded-lg border-2 border-dashed border-neutral-300 p-2 flex flex-col gap-1.5 bg-white">
              <input
                type="text"
                placeholder="Input name…"
                value={newInputName}
                onChange={(e) => setNewInputName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitInput();
                  if (e.key === "Escape") { setShowInputForm(false); setNewInputName(""); }
                }}
                className="text-xs border rounded px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-neutral-400"
                autoFocus
              />
              <div className="flex items-center gap-1">
                <select
                  value={newInputType}
                  onChange={(e) => setNewInputType(e.target.value)}
                  className="text-xs border rounded px-1 py-0.5 bg-white flex-1"
                >
                  <option value="water">💧 Water</option>
                  <option value="chemical">⚗️ Chemical</option>
                  <option value="material">📦 Material</option>
                  <option value="energy">⚡ Energy</option>
                  <option value="other">◦ Other</option>
                </select>
                <button onClick={submitInput}
                  className="text-xs text-green-600 hover:text-green-800 font-semibold px-1.5 py-0.5 rounded hover:bg-green-50">✓</button>
                <button onClick={() => { setShowInputForm(false); setNewInputName(""); }}
                  className="text-xs text-neutral-400 hover:text-neutral-600 px-1 py-0.5">✕</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowInputForm(true)}
              className="text-xs text-neutral-400 hover:text-neutral-600 flex items-center gap-0.5 py-0.5"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
              </svg>
              Add input
            </button>
          )}
        </div>
      </div>

      {/* ── Connector arrow ───────────────────────────────────────────── */}
      <div className="w-12 shrink-0 flex items-center justify-center self-stretch">
        {inputs.length > 0 && (
          <svg width="48" height="14" viewBox="0 0 48 14" className="text-neutral-400">
            <line x1="0" y1="7" x2="36" y2="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M32 3 L44 7 L32 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        )}
      </div>

      {/* ── Step box ──────────────────────────────────────────────────── */}
      <div className={cn(
        "flex-1 flex items-stretch rounded-xl border-2 bg-gradient-to-r overflow-hidden shadow-sm hover:shadow-md transition-shadow",
        bgClass,
      )}>
        {/* Drag handle */}
        <button
          {...attributes} {...listeners}
          className="w-8 shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing border-r border-black/5 hover:bg-black/5 transition-colors"
          aria-label="Drag to reorder"
        >
          <svg className="w-3.5 h-3.5 text-neutral-400" fill="currentColor" viewBox="0 0 16 16">
            <circle cx="5" cy="3" r="1.5" /><circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" /><circle cx="11" cy="13" r="1.5" />
          </svg>
        </button>

        {/* Clickable link to hazard analysis */}
        <Link href={`/plans/${planId}/steps/${step.id}`} className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0">
          <div className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
            step.isCcp ? "bg-red-600 text-white" : "bg-white/80 text-neutral-700 border border-neutral-200",
          )}>
            {step.stepNumber}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-neutral-900 truncate">{step.name}</span>
              {step.isCcp && (
                <Badge variant="destructive" className="text-xs font-bold shrink-0">{step.ccpNumber}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {step.category && (
                <span className="text-xs text-neutral-500 capitalize">
                  {CATEGORY_ICONS[step.category] ?? ""} {step.category}
                </span>
              )}
              {step.description && (
                <span className="text-xs text-neutral-400 truncate hidden sm:inline">— {step.description}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {hazardCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/80 border border-neutral-200 text-neutral-600 font-medium">
                {hazardCount} hazard{hazardCount !== 1 ? "s" : ""}
              </span>
            )}
            {step.isCcp && <span className="text-[10px] text-red-600 font-medium">Critical Control Point</span>}
          </div>
        </Link>

        {/* Delete button */}
        <button
          onClick={(e) => { e.preventDefault(); if (confirm(`Delete step "${step.name}"?`)) onDelete(); }}
          className="w-8 shrink-0 flex items-center justify-center border-l border-black/5 text-neutral-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
          title="Delete step"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
