"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
  status: string;
  effectiveDate: string | null;
  clonedFromVersionId: string | null;
  isRestorable: boolean;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-100 text-green-700 border-green-200",
    superseded: "bg-red-100 text-red-600 border-red-200",
    draft: "bg-amber-100 text-amber-700 border-amber-200",
    archived: "bg-neutral-100 text-neutral-500 border-neutral-200",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded border uppercase tracking-wide ${styles[status] ?? styles.archived}`}>
      {status}
    </span>
  );
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

function VersionCard({
  version,
  planId,
  onCloned,
}: {
  version: Version;
  planId: string;
  onCloned: (v: Version) => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const hasLog = version.changeLog && version.changeLog.length > 0;

  const isActive = version.status === "active";
  const isDraft = version.status === "draft";

  async function handleClone() {
    setCloning(true);
    setCloneError(null);
    try {
      const res = await fetch(`/api/plans/${planId}/versions/${version.id}/clone`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Clone failed");
      const data = await res.json();
      onCloned({
        id: data.id,
        versionNumber: data.versionNumber,
        publishedAt: data.publishedAt,
        publishedBy: null,
        changeDescription: data.changeDescription,
        changeLog: null,
        status: "draft",
        effectiveDate: null,
        clonedFromVersionId: version.id,
        isRestorable: true,
      });
    } catch {
      setCloneError("Clone failed. Try again.");
    } finally {
      setCloning(false);
    }
  }

  return (
    <div className={`border rounded-lg overflow-hidden ${isActive ? "border-green-300 bg-green-50/30" : isDraft ? "border-amber-300 bg-amber-50/20" : "border-neutral-200 bg-white"}`}>
      <div className="flex items-center justify-between px-4 py-3 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Badge variant="outline" className="font-mono shrink-0">
            v{version.versionNumber}
          </Badge>
          <StatusBadge status={version.status} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-800 truncate">
              {version.changeDescription || (hasLog ? `${version.changeLog!.length} change${version.changeLog!.length !== 1 ? "s" : ""}` : "No description")}
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">
              {formatDateTime(version.publishedAt)}
              {version.publishedBy && (
                <span className="ml-1">
                  · by <span className="font-medium text-neutral-700">{version.publishedBy}</span>
                </span>
              )}
              {version.effectiveDate && (
                <span className="ml-1 text-neutral-400">
                  · effective {formatDateTime(version.effectiveDate)}
                </span>
              )}
              {version.clonedFromVersionId && (
                <span className="ml-1 italic text-amber-600">· cloned</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* View button */}
          <button
            onClick={() => router.push(`/plans/${planId}/versions/${version.id}`)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition"
          >
            View
          </button>

          {/* Clone button — only on superseded/draft, not the live active version */}
          {!isActive && version.isRestorable && (
            <button
              onClick={handleClone}
              disabled={cloning}
              className="text-xs text-amber-700 hover:text-amber-900 font-medium px-2 py-1 rounded hover:bg-amber-50 transition disabled:opacity-50"
            >
              {cloning ? "Cloning…" : "Clone to Draft"}
            </button>
          )}

          {/* Expand change log */}
          {hasLog && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800 ml-1"
            >
              <svg
                className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {expanded ? "Hide" : "Changes"} ({version.changeLog!.length})
            </button>
          )}
        </div>
      </div>

      {cloneError && (
        <div className="px-4 pb-2 text-xs text-red-600">{cloneError}</div>
      )}

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
      // Mark previous active → superseded in local state
      setVersions((prev) =>
        [
          {
            id: data.id,
            versionNumber: data.versionNumber,
            publishedAt: data.publishedAt,
            publishedBy: publishedBy || null,
            changeDescription: notes || null,
            changeLog: data.changeLog,
            status: "active",
            effectiveDate: data.effectiveDate ?? null,
            clonedFromVersionId: null,
            isRestorable: true,
          },
          ...prev.map((v) =>
            v.status === "active" ? { ...v, status: "superseded" } : v,
          ),
        ]
      );
      setDialogOpen(false);
      setNotes("");
      setDiffChanges(null);
    }
    setPublishing(false);
  }

  const activeVersion = versions.find((v) => v.status === "active");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Version History</h2>
          <p className="text-sm text-neutral-500">
            Each published version is an immutable snapshot. Superseded versions can be viewed (read-only) or cloned to a new draft.
          </p>
        </div>
        <Button onClick={openDialog}>Publish New Version</Button>
      </div>

      {/* Active version callout */}
      {activeVersion && (
        <div className="mb-4 flex items-center gap-3 border border-green-300 bg-green-50 rounded-lg px-4 py-2 text-sm text-green-800">
          <span className="font-semibold">Current active version:</span>
          <span>v{activeVersion.versionNumber}</span>
          {activeVersion.effectiveDate && (
            <span className="text-green-600">
              · effective {formatDateTime(activeVersion.effectiveDate)}
            </span>
          )}
        </div>
      )}

      {/* Publish dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setDiffChanges(null); }}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Publish Version {nextVersion !== null ? `v${nextVersion}` : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <Label className="mb-2 block">Changes since last version</Label>
              <div className="border rounded-lg bg-neutral-50 px-4 py-3 min-h-[120px] max-h-[300px] overflow-y-auto">
                {diffLoading ? (
                  <div className="flex items-center gap-2 text-sm text-neutral-500 py-4 justify-center">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Analysing changes…
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

            <div>
              <Label>Published by *</Label>
              <Input
                value={publishedBy}
                onChange={(e) => setPublishedBy(e.target.value)}
                placeholder="Your name / role"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Additional notes <span className="text-neutral-400 font-normal">(optional)</span></Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any extra context for this version…"
                rows={2}
                className="mt-1 text-sm"
              />
            </div>

            <Button
              onClick={publishVersion}
              disabled={publishing || !publishedBy.trim()}
              className="w-full"
            >
              {publishing ? "Publishing…" : `Publish v${nextVersion ?? ""}`}
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
            <VersionCard
              key={v.id}
              version={v}
              planId={planId}
              onCloned={(newDraft) =>
                setVersions((prev) => [newDraft, ...prev])
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
