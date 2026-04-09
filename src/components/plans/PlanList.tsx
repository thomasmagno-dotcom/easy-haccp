"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";

interface Plan {
  id: string;
  name: string;
  facilityName: string;
  status: string;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export function PlanList({ plans: initialPlans }: { plans: Plan[] }) {
  const [plans, setPlans] = useState(initialPlans);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [newFacilityName, setNewFacilityName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const router = useRouter();

  function openDialog() {
    setNewPlanName("");
    setNewFacilityName("");
    setDialogOpen(true);
  }

  async function duplicatePlan(planId: string) {
    setDuplicatingId(planId);
    const res = await fetch(`/api/plans/${planId}/duplicate`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      const now = new Date().toISOString();
      setPlans((prev) => [
        {
          id: data.id,
          name: data.name,
          facilityName: data.facilityName,
          status: "draft",
          currentVersion: 0,
          createdAt: now,
          updatedAt: now,
        },
        ...prev,
      ]);
      router.push(`/plans/${data.id}/process-flow`);
    }
    setDuplicatingId(null);
  }

  async function deletePlan(planId: string) {
    setDeletingId(planId);
    const res = await fetch(`/api/plans/${planId}`, { method: "DELETE" });
    if (res.ok) {
      setPlans((prev) => prev.filter((p) => p.id !== planId));
    }
    setDeletingId(null);
    setConfirmDeleteId(null);
  }

  async function createPlan() {
    if (!newPlanName.trim() || !newFacilityName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newPlanName.trim(),
        facilityName: newFacilityName.trim(),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const now = new Date().toISOString();
      setPlans((prev) => [
        {
          id: data.id,
          name: newPlanName.trim(),
          facilityName: newFacilityName.trim(),
          status: "draft",
          currentVersion: 0,
          createdAt: now,
          updatedAt: now,
        },
        ...prev,
      ]);
      setDialogOpen(false);
      router.push(`/plans/${data.id}/process-flow`);
    }
    setCreating(false);
  }

  if (plans.length === 0) {
    return (
      <>
        <div className="text-center py-16 border-2 border-dashed border-neutral-200 rounded-lg">
          <h3 className="text-lg font-medium text-neutral-700 mb-2">
            No HACCP plans yet
          </h3>
          <p className="text-sm text-neutral-500 mb-6 max-w-sm mx-auto">
            Get started by creating your first HACCP plan.
          </p>
          <Button onClick={openDialog}>Create New HACCP Plan</Button>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New HACCP Plan</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Plan Name *</Label>
                <Input
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  placeholder="e.g. Fresh-Cut Produce HACCP Plan"
                  className="mt-1"
                  onKeyDown={(e) => e.key === "Enter" && createPlan()}
                  autoFocus
                />
              </div>
              <div>
                <Label>Facility Name *</Label>
                <Input
                  value={newFacilityName}
                  onChange={(e) => setNewFacilityName(e.target.value)}
                  placeholder="e.g. Main Processing Facility"
                  className="mt-1"
                  onKeyDown={(e) => e.key === "Enter" && createPlan()}
                />
              </div>
              <Button
                onClick={createPlan}
                disabled={creating || !newPlanName.trim() || !newFacilityName.trim()}
                className="w-full"
              >
                {creating ? "Creating..." : "Create Plan"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex justify-end mb-4">
          <Button onClick={openDialog} disabled={creating}>
            New Plan
          </Button>
        </div>
        {plans.map((plan) => (
          <div key={plan.id} className="relative group/card">
            <Link href={`/plans/${plan.id}/process-flow`}>
              <Card className="hover:border-neutral-300 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    <Badge
                      variant={
                        plan.status === "published" ? "default" : "secondary"
                      }
                    >
                      {plan.status}
                    </Badge>
                  </div>
                  <CardDescription>{plan.facilityName}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-xs text-neutral-500">
                    <span>Version {plan.currentVersion}</span>
                    <span>Updated {formatDate(plan.updatedAt)}</span>
                    <span>Created {formatDate(plan.createdAt)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
            {/* Action buttons — shown on hover */}
            <div className="absolute top-3 right-3 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center gap-1">
              {/* Duplicate */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  duplicatePlan(plan.id);
                }}
                disabled={duplicatingId === plan.id}
                className="p-1.5 rounded-md text-neutral-400 hover:text-blue-500 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-wait"
                title="Duplicate plan"
              >
                {duplicatingId === plan.id ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
              {/* Delete */}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setConfirmDeleteId(plan.id);
                }}
                className="p-1.5 rounded-md text-neutral-400 hover:text-red-500 hover:bg-red-50"
                title="Delete plan"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New HACCP Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Plan Name *</Label>
              <Input
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                placeholder="e.g. Fresh-Cut Produce HACCP Plan"
                className="mt-1"
                onKeyDown={(e) => e.key === "Enter" && createPlan()}
                autoFocus
              />
            </div>
            <div>
              <Label>Facility Name *</Label>
              <Input
                value={newFacilityName}
                onChange={(e) => setNewFacilityName(e.target.value)}
                placeholder="e.g. Main Processing Facility"
                className="mt-1"
                onKeyDown={(e) => e.key === "Enter" && createPlan()}
              />
            </div>
            <Button
              onClick={createPlan}
              disabled={creating || !newPlanName.trim() || !newFacilityName.trim()}
              className="w-full"
            >
              {creating ? "Creating..." : "Create Plan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!confirmDeleteId} onOpenChange={(o) => { if (!o) setConfirmDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Plan?</DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <p className="text-sm text-neutral-600">
              This will permanently delete{" "}
              <span className="font-semibold">
                {plans.find((p) => p.id === confirmDeleteId)?.name}
              </span>{" "}
              and all its data — steps, hazard analysis, versions, and audit logs. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={deletingId === confirmDeleteId}
                onClick={() => confirmDeleteId && deletePlan(confirmDeleteId)}
              >
                {deletingId === confirmDeleteId ? "Deleting..." : "Delete Plan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
