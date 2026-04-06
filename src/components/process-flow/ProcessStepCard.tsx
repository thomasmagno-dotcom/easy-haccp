"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const CATEGORY_COLORS: Record<string, string> = {
  receiving: "bg-blue-50 text-blue-700 border-blue-200",
  storage: "bg-cyan-50 text-cyan-700 border-cyan-200",
  processing: "bg-amber-50 text-amber-700 border-amber-200",
  packaging: "bg-green-50 text-green-700 border-green-200",
  shipping: "bg-purple-50 text-purple-700 border-purple-200",
};

export function ProcessStepCard({ step, hazardCount, planId, onDelete }: Props) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border bg-white transition-shadow",
        step.isCcp
          ? "border-red-200 bg-red-50/30"
          : "border-neutral-200",
        isDragging && "shadow-lg opacity-90 z-10",
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-neutral-400 hover:text-neutral-600"
        aria-label="Drag to reorder"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
          <circle cx="5" cy="3" r="1.5" />
          <circle cx="11" cy="3" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="13" r="1.5" />
          <circle cx="11" cy="13" r="1.5" />
        </svg>
      </button>

      {/* Step number */}
      <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-sm font-semibold text-neutral-600 shrink-0">
        {step.stepNumber}
      </div>

      {/* Step info */}
      <Link
        href={`/plans/${planId}/steps/${step.id}`}
        className="flex-1 min-w-0"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{step.name}</span>
          {step.isCcp && (
            <Badge variant="destructive" className="text-xs shrink-0">
              {step.ccpNumber}
            </Badge>
          )}
        </div>
        {step.description && (
          <p className="text-xs text-neutral-500 truncate mt-0.5">
            {step.description}
          </p>
        )}
      </Link>

      {/* Badges */}
      <div className="flex items-center gap-2 shrink-0">
        {step.category && (
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded border",
              CATEGORY_COLORS[step.category] || "bg-neutral-50 text-neutral-600 border-neutral-200",
            )}
          >
            {step.category}
          </span>
        )}
        {hazardCount > 0 && (
          <Badge variant="outline" className="text-xs">
            {hazardCount} hazard{hazardCount !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Delete */}
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.preventDefault();
          if (confirm(`Delete step "${step.name}"?`)) {
            onDelete();
          }
        }}
        className="text-neutral-400 hover:text-red-600 shrink-0"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </Button>
    </div>
  );
}
