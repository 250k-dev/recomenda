"use client";

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/domain/page-header";

const data = [
  { name: "Safra A", custo: 1200, produtividade: 62 },
  { name: "Safra B", custo: 980, produtividade: 58 },
  { name: "Safra C", custo: 1430, produtividade: 66 },
];

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Relatórios" description="Custos por hectare e produtividade." />
      <Card className="overflow-x-auto">
        <BarChart width={720} height={320} data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="custo" fill="#2f7d32" />
        </BarChart>
      </Card>
    </>
  );
}
