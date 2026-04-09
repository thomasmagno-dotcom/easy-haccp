"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubgraphStep {
  id: string;
  inputId: string;
  name: string;
  stepNumber: number;
  category: string;
}

interface StepInput {
  id: string;
  stepId: string;
  name: string;
  type: string;
  subSteps: SubgraphStep[];
}

interface ProcessStep {
  id: string;
  stepNumber: number;
  name: string;
  category: string;
  isCcp: boolean;
  ccpNumber?: string;
}

// ── Static style config ───────────────────────────────────────────────────────

const INPUT_TYPE_CONFIG: Record<string, { border: string; header: string; icon: string; label: string }> = {
  water:    { border: "border-blue-200",   header: "bg-blue-100 text-blue-700",     icon: "💧", label: "Water"    },
  chemical: { border: "border-orange-200", header: "bg-orange-100 text-orange-700", icon: "⚗️", label: "Chemical" },
  material: { border: "border-green-200",  header: "bg-green-100 text-green-700",   icon: "📦", label: "Material" },
  energy:   { border: "border-yellow-200", header: "bg-yellow-100 text-yellow-700", icon: "⚡", label: "Energy"   },
  other:    { border: "border-neutral-200",header: "bg-neutral-100 text-neutral-600",icon: "◦", label: "Other"    },
};

const SUBSTEP_CATEGORY_CONFIG: Record<string, { icon: string; label: string; bg: string }> = {
  receiving:   { icon: "📥", label: "Receiving",   bg: "bg-blue-50 border-blue-200"    },
  storage:     { icon: "🧊", label: "Storage",     bg: "bg-cyan-50 border-cyan-200"    },
  inspection:  { icon: "🔍", label: "Inspection",  bg: "bg-purple-50 border-purple-200"},
  processing:  { icon: "⚙️", label: "Processing",  bg: "bg-amber-50 border-amber-200"  },
  transport:   { icon: "🚚", label: "Transport",   bg: "bg-neutral-50 border-neutral-200"},
  other:       { icon: "▪",  label: "Other",       bg: "bg-neutral-50 border-neutral-200"},
};

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

// ── Initial mock data ─────────────────────────────────────────────────────────

const INITIAL_STEPS: ProcessStep[] = [
  { id: "s1", stepNumber: 1, name: "Receiving of Raw Materials",  category: "receiving",  isCcp: false },
  { id: "s2", stepNumber: 2, name: "Cold Storage",               category: "storage",    isCcp: false },
  { id: "s3", stepNumber: 3, name: "Washing & Sanitizing",       category: "processing", isCcp: false },
  { id: "s4", stepNumber: 4, name: "Packaging",                  category: "packaging",  isCcp: true, ccpNumber: "CCP-1" },
  { id: "s5", stepNumber: 5, name: "Shipping",                   category: "shipping",   isCcp: false },
];

const INITIAL_INPUTS: Record<string, StepInput[]> = {
  s1: [
    { id: "i1", stepId: "s1", name: "Raw vegetables", type: "material", subSteps: [] },
  ],
  s3: [
    { id: "i2", stepId: "s3", name: "Process water",       type: "water",    subSteps: [] },
    { id: "i3", stepId: "s3", name: "Sanitizer solution",  type: "chemical", subSteps: [] },
  ],
  s4: [
    {
      id: "i4",
      stepId: "s4",
      name: "Packaging materials",
      type: "material",
      subSteps: [
        { id: "ss1", inputId: "i4", name: "Receiving of packaging",      stepNumber: 1, category: "receiving"  },
        { id: "ss2", inputId: "i4", name: "Storage of packaging mats.",   stepNumber: 2, category: "storage"   },
      ],
    },
    { id: "i5", stepId: "s4", name: "Labels", type: "material", subSteps: [] },
  ],
};

// ── ID generator ──────────────────────────────────────────────────────────────
let _idCounter = 100;
function newId() { return `mock-${++_idCounter}`; }

// ── Sub-component: one subgraph step row ─────────────────────────────────────

function SubgraphStepRow({
  ss,
  isFirst,
  isLast,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  ss: SubgraphStep;
  isFirst: boolean;
  isLast: boolean;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const cfg = SUBSTEP_CATEGORY_CONFIG[ss.category] ?? SUBSTEP_CATEGORY_CONFIG.other;
  return (
    <div className="group/ss flex flex-col items-center w-full">
      {/* Step box */}
      <div className={cn("w-full flex items-center gap-1.5 rounded-md border px-2 py-1.5", cfg.bg)}>
        {/* Number */}
        <span className="w-4 h-4 rounded-full bg-white border border-neutral-300 flex items-center justify-center text-[9px] font-bold text-neutral-600 shrink-0">
          {ss.stepNumber}
        </span>
        {/* Icon + name */}
        <span className="text-[10px]">{cfg.icon}</span>
        <span className="text-xs text-neutral-700 font-medium flex-1 truncate">{ss.name}</span>
        {/* Reorder + delete (on hover) */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover/ss:opacity-100 transition-opacity shrink-0">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="w-4 h-4 flex items-center justify-center text-neutral-400 hover:text-neutral-700 disabled:opacity-20"
            title="Move up"
          >
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="w-4 h-4 flex items-center justify-center text-neutral-400 hover:text-neutral-700 disabled:opacity-20"
            title="Move down"
          >
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="w-4 h-4 flex items-center justify-center text-neutral-300 hover:text-red-400"
            title="Delete step"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      {/* Down-arrow connector (except after last step) */}
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

// ── Sub-component: one input subgraph box ─────────────────────────────────────

function InputSubgraphBox({
  input,
  onDeleteInput,
  onAddSubStep,
  onDeleteSubStep,
  onMoveSubStep,
}: {
  input: StepInput;
  onDeleteInput: () => void;
  onAddSubStep: (name: string, category: string) => void;
  onDeleteSubStep: (subStepId: string) => void;
  onMoveSubStep: (subStepId: string, direction: "up" | "down") => void;
}) {
  const [showStepForm, setShowStepForm] = useState(false);
  const [newStepName, setNewStepName] = useState("");
  const [newStepCategory, setNewStepCategory] = useState("receiving");

  const cfg = INPUT_TYPE_CONFIG[input.type] ?? INPUT_TYPE_CONFIG.other;
  const sorted = [...input.subSteps].sort((a, b) => a.stepNumber - b.stepNumber);

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
        <button
          onClick={onDeleteInput}
          className="opacity-50 hover:opacity-100 transition-opacity"
          title="Remove input"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Input name + sub-flow */}
      <div className="bg-white px-2 py-2 flex flex-col gap-1.5">

        {/* Input label */}
        <p className="text-xs font-semibold text-neutral-700 truncate leading-tight">
          {input.name}
        </p>

        {/* Sub-flow steps */}
        {sorted.length > 0 && (
          <div className="mt-1 flex flex-col">
            {/* Entry connector */}
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

        {/* Add step form / button */}
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
                <button
                  onClick={submitStep}
                  className="text-xs text-green-600 hover:text-green-800 font-semibold px-1.5 py-0.5 rounded hover:bg-green-50"
                >✓</button>
                <button
                  onClick={() => { setShowStepForm(false); setNewStepName(""); }}
                  className="text-xs text-neutral-400 hover:text-neutral-600 px-1 py-0.5"
                >✕</button>
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

// ── Sub-component: one FlowNode row ───────────────────────────────────────────

function FlowNodeRow({
  step,
  inputs,
  onDeleteInput,
  onAddInput,
  onAddSubStep,
  onDeleteSubStep,
  onMoveSubStep,
}: {
  step: ProcessStep;
  inputs: StepInput[];
  onDeleteInput: (inputId: string) => void;
  onAddInput: (name: string, type: string) => void;
  onAddSubStep: (inputId: string, name: string, category: string) => void;
  onDeleteSubStep: (inputId: string, subStepId: string) => void;
  onMoveSubStep: (inputId: string, subStepId: string, direction: "up" | "down") => void;
}) {
  const [showInputForm, setShowInputForm] = useState(false);
  const [newInputName, setNewInputName] = useState("");
  const [newInputType, setNewInputType] = useState("material");

  // Group inputs by type in canonical order
  const TYPE_ORDER = ["water", "chemical", "material", "energy", "other"];
  const groupedInputs: StepInput[][] = [];
  const seen = new Set<string>();
  for (const t of TYPE_ORDER) {
    const group = inputs.filter((i) => (i.type || "other") === t);
    if (group.length) { groupedInputs.push(group); seen.add(t); }
  }
  for (const inp of inputs) {
    if (!seen.has(inp.type || "other")) groupedInputs.push([inp]);
  }
  const flatInputs = groupedInputs.flat();

  const bgClass = step.isCcp
    ? "from-red-50 to-red-100/60 border-red-300 ring-2 ring-red-200/50"
    : CATEGORY_BG[step.category] ?? "from-neutral-50 to-neutral-100/50 border-neutral-200";

  function submitInput() {
    if (newInputName.trim()) {
      onAddInput(newInputName.trim(), newInputType);
      setNewInputName("");
      setShowInputForm(false);
    }
  }

  return (
    <div className="flex items-center w-full group">

      {/* ── Left zone: input subgraphs ─── */}
      <div className="w-56 shrink-0 flex flex-col gap-2 pr-2 self-stretch justify-center">

        {flatInputs.map((inp) => (
          <InputSubgraphBox
            key={inp.id}
            input={inp}
            onDeleteInput={() => onDeleteInput(inp.id)}
            onAddSubStep={(name, cat) => onAddSubStep(inp.id, name, cat)}
            onDeleteSubStep={(ssId) => onDeleteSubStep(inp.id, ssId)}
            onMoveSubStep={(ssId, dir) => onMoveSubStep(inp.id, ssId, dir)}
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
                <button onClick={submitInput} className="text-xs text-green-600 hover:text-green-800 font-semibold px-1.5 py-0.5 rounded hover:bg-green-50">✓</button>
                <button onClick={() => { setShowInputForm(false); setNewInputName(""); }} className="text-xs text-neutral-400 hover:text-neutral-600 px-1 py-0.5">✕</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowInputForm(true)}
              className="text-xs text-neutral-400 hover:text-neutral-600 flex items-center gap-0.5"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
              </svg>
              Add input
            </button>
          )}
        </div>
      </div>

      {/* ── Connector arrow ─── */}
      <div className="w-12 shrink-0 flex items-center justify-center self-stretch">
        {flatInputs.length > 0 && (
          <svg width="48" height="14" viewBox="0 0 48 14" className="text-neutral-400">
            <line x1="0" y1="7" x2="36" y2="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M32 3 L44 7 L32 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        )}
      </div>

      {/* ── Step box ─── */}
      <div className={cn(
        "flex-1 flex items-stretch rounded-xl border-2 bg-gradient-to-r overflow-hidden shadow-sm",
        bgClass,
      )}>
        {/* Drag handle placeholder */}
        <div className="w-8 shrink-0 flex items-center justify-center border-r border-black/5">
          <svg className="w-3.5 h-3.5 text-neutral-300" fill="currentColor" viewBox="0 0 16 16">
            <circle cx="5" cy="3" r="1.5" /><circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" /><circle cx="11" cy="13" r="1.5" />
          </svg>
        </div>
        {/* Content */}
        <div className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0">
          <div className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
            step.isCcp ? "bg-red-600 text-white" : "bg-white/80 text-neutral-700 border border-neutral-200",
          )}>
            {step.stepNumber}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-neutral-900">{step.name}</span>
              {step.isCcp && (
                <span className="text-xs font-bold bg-red-600 text-white px-2 py-0.5 rounded-full shrink-0">
                  {step.ccpNumber}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-xs text-neutral-500 capitalize">
                {CATEGORY_ICONS[step.category] ?? ""} {step.category}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InputsTestPage() {
  const [steps] = useState<ProcessStep[]>(INITIAL_STEPS);
  const [inputsByStep, setInputsByStep] = useState<Record<string, StepInput[]>>(INITIAL_INPUTS);

  // ── Input CRUD ─────────────────────────────────────────────────────────────

  const addInput = useCallback((stepId: string, name: string, type: string) => {
    const newInput: StepInput = { id: newId(), stepId, name, type, subSteps: [] };
    setInputsByStep((prev) => ({
      ...prev,
      [stepId]: [...(prev[stepId] ?? []), newInput],
    }));
  }, []);

  const deleteInput = useCallback((stepId: string, inputId: string) => {
    setInputsByStep((prev) => ({
      ...prev,
      [stepId]: (prev[stepId] ?? []).filter((i) => i.id !== inputId),
    }));
  }, []);

  // ── Subgraph step CRUD ─────────────────────────────────────────────────────

  const addSubStep = useCallback((stepId: string, inputId: string, name: string, category: string) => {
    setInputsByStep((prev) => {
      const inputs = prev[stepId] ?? [];
      return {
        ...prev,
        [stepId]: inputs.map((inp) => {
          if (inp.id !== inputId) return inp;
          const nextNum = (inp.subSteps.length > 0 ? Math.max(...inp.subSteps.map((s) => s.stepNumber)) : 0) + 1;
          const newSS: SubgraphStep = { id: newId(), inputId, name, stepNumber: nextNum, category };
          return { ...inp, subSteps: [...inp.subSteps, newSS] };
        }),
      };
    });
  }, []);

  const deleteSubStep = useCallback((stepId: string, inputId: string, subStepId: string) => {
    setInputsByStep((prev) => {
      const inputs = prev[stepId] ?? [];
      return {
        ...prev,
        [stepId]: inputs.map((inp) => {
          if (inp.id !== inputId) return inp;
          const filtered = inp.subSteps
            .filter((ss) => ss.id !== subStepId)
            .map((ss, i) => ({ ...ss, stepNumber: i + 1 }));
          return { ...inp, subSteps: filtered };
        }),
      };
    });
  }, []);

  const moveSubStep = useCallback((stepId: string, inputId: string, subStepId: string, direction: "up" | "down") => {
    setInputsByStep((prev) => {
      const inputs = prev[stepId] ?? [];
      return {
        ...prev,
        [stepId]: inputs.map((inp) => {
          if (inp.id !== inputId) return inp;
          const sorted = [...inp.subSteps].sort((a, b) => a.stepNumber - b.stepNumber);
          const idx = sorted.findIndex((ss) => ss.id === subStepId);
          if (idx === -1) return inp;
          const targetIdx = direction === "up" ? idx - 1 : idx + 1;
          if (targetIdx < 0 || targetIdx >= sorted.length) return inp;
          // Swap step numbers
          const updated = sorted.map((ss, i) => {
            if (i === idx) return { ...ss, stepNumber: sorted[targetIdx].stepNumber };
            if (i === targetIdx) return { ...ss, stepNumber: sorted[idx].stepNumber };
            return ss;
          });
          return { ...inp, subSteps: updated };
        }),
      };
    });
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-neutral-500 mb-1">
              <span>UI Prototype</span>
              <span>›</span>
              <span className="text-neutral-800 font-medium">Input Subgraph Steps</span>
            </div>
            <h1 className="text-xl font-bold text-neutral-900">Process Flow — Input Sub-flows</h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              Prototype only — no data is saved. Hover a step to add inputs. Click "+ Add step to flow" inside an input to define its own sub-flow.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-neutral-500">
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
      </div>

      {/* Diagram */}
      <div className="px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col w-full">
            {steps.map((step, index) => (
              <div key={step.id} className="flex flex-col w-full">
                <FlowNodeRow
                  step={step}
                  inputs={inputsByStep[step.id] ?? []}
                  onDeleteInput={(inputId) => deleteInput(step.id, inputId)}
                  onAddInput={(name, type) => addInput(step.id, name, type)}
                  onAddSubStep={(inputId, name, cat) => addSubStep(step.id, inputId, name, cat)}
                  onDeleteSubStep={(inputId, ssId) => deleteSubStep(step.id, inputId, ssId)}
                  onMoveSubStep={(inputId, ssId, dir) => moveSubStep(step.id, inputId, ssId, dir)}
                />

                {/* Down-arrow connector between steps */}
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
          </div>

          {/* Legend / help */}
          <div className="mt-10 p-4 rounded-xl bg-white border border-neutral-200 text-sm text-neutral-600">
            <p className="font-semibold text-neutral-800 mb-2">How it works</p>
            <ul className="space-y-1 text-xs list-disc pl-4">
              <li>Hover any step to reveal the <strong>Add input</strong> button in the left column.</li>
              <li>Each input gets its own <strong>typed subgraph box</strong> (Water 💧, Chemical ⚗️, Material 📦, Energy ⚡).</li>
              <li>Inside a subgraph box, click <strong>+ Add step to flow</strong> to add processing steps that happen to the input <em>before</em> it enters the main flow (e.g. Receiving → Storage of packaging materials).</li>
              <li>Use the <strong>▲ ▼</strong> arrows to reorder steps within the sub-flow.</li>
              <li>When sub-flow steps exist, the subgraph is connected to the main step with a <strong>→ arrow</strong>.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
