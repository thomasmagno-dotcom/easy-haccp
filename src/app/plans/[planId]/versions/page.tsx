"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";
import type { ChangeEntry } from "@/lib/diff-snapshots";

const SECTION_LABELS: Record<string, string> = {
  plan: "Plan & Product",
  team: "HACCP Team",
  steps: "Process Steps",
  ingredients: "Ingredients",
};

const SECTION_COLORS: Record<string, string> = {
  plan: "bg-blue-100 text-blue-700",
  team: "bg-purple-100 text-purple-700",
  steps: "bg-yellow-100 text-yellow-700",
  ingredients: "bg-green-100 text-green-700",
};

interface Version {
  id: string;
  versionNumber: number;
  publishedAt: string;
  publishedBy: string | null;
  changeDescription: string | null;
  changeLog: ChangeEntry[] | null;
}

function ChangeLogList({ entries }: { entries: ChangeEntry[] }) {
  const grouped = entries.reduce<Record<string, ChangeEntry[]>>((acc, e) => {
    if (!acc[e.section]) acc[e.section] = [];
    acc[e.section].push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([section, items]) => (
        <div key={section}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${SECTION_COLORS[section] || "bg-neutral-100 text-neutral-600"}`}>
              {SECTION_LABELS[section] || section}
            </span>
          </div>
          <ul className="space-y-1 ml-2">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                <span className="text-neutral-400 mt-0.5 shrink-0">•</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function VersionCard({ version }: { version: Version }) {
  const [expanded, setExpanded] = useState(false);
  const hasLog = version.changeLog && version.changeLog.length > 0;

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="font-mono shrink-0">
            v{version.versionNumber}
          </Badge>
          <div>
            <p className="text-sm font-medium text-neutral-800">
              {version.changeDescription || (hasLog ? `${version.changeLog!.length} change${version.changeLog!.length !== 1 ? "s" : ""}` : "No description")}
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">
              {formatDateTime(version.publishedAt)}
              {version.publishedBy && (
                <span className="ml-1">
                  · by <span className="font-medium text-neutral-700">{version.publishedBy}</span>
                </span>
              )}
            </p>
          </div>
        </div>
        {hasLog && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800 shrink-0 ml-4"
          >
            <svg
              className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {expanded ? "Hide" : "View"} changes ({version.changeLog!.length})
          </button>
        )}
      </div>

      {expanded && hasLog && (
        <div className="border-t bg-neutral-50 px-4 py-3">
          <ChangeLogList entries={version.changeLog!} />
        </div>
      )}
    </div>
  );
}

export default function VersionsPage() {
  const params = useParams();
  const planId = params.planId as string;

  const [versions, setVersions] = useState<Version[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [publishedBy, setPublishedBy] = useState("");

  // Diff preview state
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffChanges, setDiffChanges] = useState<ChangeEntry[] | null>(null);
  const [nextVersion, setNextVersion] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/plans/${planId}/versions`)
      .then((r) => r.json())
      .then(setVersions);
  }, [planId]);

  const loadDiff = useCallback(async () => {
    setDiffLoading(true);
    setDiffChanges(null);
    try {
      const res = await fetch(`/api/plans/${planId}/versions/diff`);
      if (res.ok) {
        const data = await res.json();
        setDiffChanges(data.changes);
        setNextVersion(data.nextVersion);
      }
    } finally {
      setDiffLoading(false);
    }
  }, [planId]);

  function openDialog() {
    setDialogOpen(true);
    loadDiff();
  }

  async function publishVersion() {
    setPublishing(true);
    const res = await fetch(`/api/plans/${planId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changeDescription: notes || null, publishedBy }),
    });
    if (res.ok) {
      const data = await res.json();
      setVersions((prev) => [
        {
          id: data.id,
          versionNumber: data.versionNumber,
          publishedAt: data.publishedAt,
          publishedBy: publishedBy || null,
          changeDescription: notes || null,
          changeLog: data.changeLog,
        },
        ...prev,
      ]);
      setDialogOpen(false);
      setNotes("");
      setDiffChanges(null);
    }
    setPublishing(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Version History</h2>
          <p className="text-sm text-neutral-500">
            Each published version is an immutable snapshot with an automatic change log.
          </p>
        </div>
        <Button onClick={openDialog}>Publish New Version</Button>
      </div>

      {/* Publish dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setDiffChanges(null); }}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Publish Version {nextVersion !== null ? `v${nextVersion}` : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Auto-generated change log preview */}
            <div>
              <Label className="mb-2 block">Changes since last version</Label>
              <div className="border rounded-lg bg-neutral-50 px-4 py-3 min-h-[120px] max-h-[300px] overflow-y-auto">
                {diffLoading ? (
                  <div className="flex items-center gap-2 text-sm text-neutral-500 py-4 justify-center">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Analysing changes...
                  </div>
                ) : diffChanges && diffChanges.length > 0 ? (
                  <ChangeLogList entries={diffChanges} />
                ) : diffChanges && diffChanges.length === 0 ? (
                  <p className="text-sm text-neutral-500 italic text-center py-4">No changes detected since last version.</p>
                ) : null}
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                This log is generated automatically and saved with the version.
              </p>
            </div>

            {/* Published by */}
            <div>
              <Label>Published by *</Label>
              <Input
                value={publishedBy}
                onChange={(e) => setPublishedBy(e.target.value)}
                placeholder="Your name / role"
                className="mt-1"
              />
            </div>

            {/* Optional notes */}
            <div>
              <Label>Additional notes <span className="text-neutral-400 font-normal">(optional)</span></Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any extra context for this version..."
                rows={2}
                className="mt-1 text-sm"
              />
            </div>

            <Button
              onClick={publishVersion}
              disabled={publishing || !publishedBy.trim()}
              className="w-full"
            >
              {publishing ? "Publishing..." : `Publish v${nextVersion ?? ""}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Version history list */}
      {versions.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-neutral-200 rounded-lg">
          <p className="text-neutral-500">
            No versions published yet. Click &quot;Publish New Version&quot; to create the first snapshot.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((v) => (
            <VersionCard key={v.id} version={v} />
          ))}
        </div>
      )}
    </div>
  );
}
