"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/utils";

interface Version {
  id: string;
  versionNumber: number;
  publishedAt: string;
  publishedBy: string | null;
  changeDescription: string | null;
}

export default function VersionsPage() {
  const params = useParams();
  const planId = params.planId as string;
  const [versions, setVersions] = useState<Version[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [publishedBy, setPublishedBy] = useState("");

  useEffect(() => {
    fetch(`/api/plans/${planId}/versions`)
      .then((r) => r.json())
      .then(setVersions);
  }, [planId]);

  async function publishVersion() {
    setPublishing(true);
    const res = await fetch(`/api/plans/${planId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        changeDescription: description,
        publishedBy,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setVersions((prev) => [
        {
          id: data.id,
          versionNumber: data.versionNumber,
          publishedAt: new Date().toISOString(),
          publishedBy,
          changeDescription: description,
        },
        ...prev,
      ]);
      setDialogOpen(false);
      setDescription("");
    }
    setPublishing(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Version History</h2>
          <p className="text-sm text-neutral-500">
            Publish versions to create immutable snapshots for audit trail.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>Publish New Version</Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish Version</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Change Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What changed in this version?"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Published By</Label>
              <Input
                value={publishedBy}
                onChange={(e) => setPublishedBy(e.target.value)}
                placeholder="Your name / role"
                className="mt-1"
              />
            </div>
            <Button
              onClick={publishVersion}
              disabled={publishing}
              className="w-full"
            >
              {publishing ? "Publishing..." : "Publish Snapshot"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {versions.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-neutral-200 rounded-lg">
          <p className="text-neutral-500">
            No versions published yet. Click &quot;Publish New Version&quot; to create
            the first snapshot.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between p-4 border rounded-lg bg-white"
            >
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="font-mono">
                  v{v.versionNumber}
                </Badge>
                <div>
                  <p className="text-sm font-medium">
                    {v.changeDescription || "No description"}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {formatDateTime(v.publishedAt)}
                    {v.publishedBy && ` by ${v.publishedBy}`}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
