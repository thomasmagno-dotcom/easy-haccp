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
  const router = useRouter();

  async function createPlan() {
    setCreating(true);
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Baby Carrot Processing HACCP Plan",
        facilityName: "Fresh-Cut Facility",
        template: "baby-carrots",
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const now = new Date().toISOString();
      setPlans((prev) => [
        {
          id: data.id,
          name: "Baby Carrot Processing HACCP Plan",
          facilityName: "Fresh-Cut Facility",
          status: "draft",
          currentVersion: 0,
          createdAt: now,
          updatedAt: now,
        },
        ...prev,
      ]);
      router.push(`/plans/${data.id}/process-flow`);
    }
    setCreating(false);
  }

  if (plans.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed border-neutral-200 rounded-lg">
        <h3 className="text-lg font-medium text-neutral-700 mb-2">
          No HACCP plans yet
        </h3>
        <p className="text-sm text-neutral-500 mb-6 max-w-sm mx-auto">
          Get started by creating a new plan. We&apos;ll set up a baby carrot
          processing template with pre-populated hazards and process steps.
        </p>
        <Button onClick={createPlan} disabled={creating}>
          {creating ? "Creating..." : "Create Baby Carrot HACCP Plan"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end mb-4">
        <Button onClick={createPlan} disabled={creating}>
          {creating ? "Creating..." : "New Plan"}
        </Button>
      </div>
      {plans.map((plan) => (
        <Link key={plan.id} href={`/plans/${plan.id}/process-flow`}>
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
      ))}
    </div>
  );
}
