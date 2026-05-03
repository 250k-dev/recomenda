"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/domain/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSeasonTimeline } from "@/lib/api/hooks";

const tabs = ["Timeline", "Stock", "Shopping List", "Audit"] as const;
type Tab = (typeof tabs)[number];

export default function SeasonDetailPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Timeline");
  const params = useParams<{ id: string }>();
  const seasonId = params.id;
  const timeline = useSeasonTimeline(seasonId);

  return (
    <>
      <PageHeader title="Detalhe da safra" description={`Safra ${seasonId}`} />
      <div className="mb-4 flex gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? "primary" : "secondary"}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </Button>
        ))}
      </div>
      <Card>
        {activeTab === "Timeline" ? (
          <pre className="overflow-x-auto text-xs text-zinc-700">
            {JSON.stringify(timeline.data, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-zinc-600">
            Conteúdo da aba {activeTab} será consumido da API correspondente.
          </p>
        )}
      </Card>
    </>
  );
}
