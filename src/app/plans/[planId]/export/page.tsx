"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function ExportPage() {
  const params = useParams();
  const planId = params.planId as string;
  const [generating, setGenerating] = useState(false);

  async function downloadPdf() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/plans/${planId}/export/pdf`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `HACCP-Plan-${planId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Export PDF</h2>
        <p className="text-sm text-neutral-500">
          Generate a print-ready HACCP plan document in CFIA/FSEP format.
        </p>
      </div>

      <div className="border-2 border-dashed border-neutral-200 rounded-lg p-12 text-center">
        <svg
          className="w-16 h-16 mx-auto text-neutral-300 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        <h3 className="text-lg font-medium text-neutral-700 mb-2">
          HACCP Plan PDF Export
        </h3>
        <p className="text-sm text-neutral-500 mb-6 max-w-md mx-auto">
          The PDF will include: cover page, product description (Form 1),
          process flow diagram (Form 3), hazard analysis per step (Forms 5-9),
          CCP summary table (Form 10), HACCP team, and revision history.
        </p>
        <Button size="lg" onClick={downloadPdf} disabled={generating}>
          {generating ? "Generating PDF..." : "Download PDF"}
        </Button>
      </div>
    </div>
  );
}
