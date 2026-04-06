"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ProcessStep {
  id: string;
  stepNumber: number;
  name: string;
  description: string | null;
  category: string | null;
  isCcp: boolean;
  ccpNumber: string | null;
}

interface Props {
  step: ProcessStep;
  hazardCount: number;
  planId: string;
  onDelete: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  receiving: "📥",
  storage: "🧊",
  processing: "⚙️",
  packaging: "📦",
  shipping: "🚛",
};

const CATEGORY_BG: Record<string, string> = {
  receiving: "from-blue-50 to-blue-100/50 border-blue-200",
  storage: "from-cyan-50 to-cyan-100/50 border-cyan-200",
  processing: "from-amber-50 to-amber-100/50 border-amber-200",
  packaging: "from-green-50 to-green-100/50 border-green-200",
  shipping: "from-purple-50 to-purple-100/50 border-purple-200",
};

const CCP_STYLE = "from-red-50 to-red-100/60 border-red-300 ring-2 ring-red-200/50";

export function FlowNode({ step, hazardCount, planId, onDelete }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const bgClass = step.isCcp
    ? CCP_STYLE
    : CATEGORY_BG[step.category || ""] || "from-neutral-50 to-neutral-100/50 border-neutral-200";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative w-full max-w-lg group",
        isDragging && "z-50 opacity-90",
      )}
    >
      <div
        className={cn(
          "flex items-stretch rounded-xl border-2 bg-gradient-to-r overflow-hidden shadow-sm hover:shadow-md transition-shadow",
          bgClass,
        )}
      >
        {/* Drag handle — left strip */}
        <button
          {...attributes}
          {...listeners}
          className="w-8 shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing border-r border-black/5 hover:bg-black/5 transition-colors"
          aria-label="Drag to reorder"
        >
          <svg className="w-3.5 h-3.5 text-neutral-400" fill="currentColor" viewBox="0 0 16 16">
            <circle cx="5" cy="3" r="1.5" />
            <circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" />
            <circle cx="11" cy="13" r="1.5" />
          </svg>
        </button>

        {/* Main content — clickable link */}
        <Link
          href={`/plans/${planId}/steps/${step.id}`}
          className="flex-1 flex items-center gap-3 px-4 py-3 min-w-0"
        >
          {/* Step number circle */}
          <div
            className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
              step.isCcp
                ? "bg-red-600 text-white"
                : "bg-white/80 text-neutral-700 border border-neutral-200",
            )}
          >
            {step.stepNumber}
          </div>

          {/* Step details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-neutral-900 truncate">
                {step.name}
              </span>
              {step.isCcp && (
                <Badge variant="destructive" className="text-xs font-bold shrink-0">
                  {step.ccpNumber}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {step.category && (
                <span className="text-xs text-neutral-500 capitalize">
                  {step.category}
                </span>
              )}
              {step.description && (
                <span className="text-xs text-neutral-400 truncate hidden sm:inline">
                  — {step.description}
                </span>
              )}
            </div>
          </div>

          {/* Right side badges */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            {hazardCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/80 border border-neutral-200 text-neutral-600 font-medium">
                {hazardCount} hazard{hazardCount !== 1 ? "s" : ""}
              </span>
            )}
            {step.isCcp && (
              <span className="text-[10px] text-red-600 font-medium">
                Critical Control Point
              </span>
            )}
          </div>
        </Link>

        {/* Delete button — right strip */}
        <button
          onClick={(e) => {
            e.preventDefault();
            if (confirm(`Delete step "${step.name}"?`)) {
              onDelete();
            }
          }}
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
