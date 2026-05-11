"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/domain/page-header";
import { TableRowsSkeleton } from "@/components/domain/page-skeletons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { useAdminAgronomistDetail, usePlans } from "@/lib/api/hooks";

export default function AdminAgronomistDetailPage() {
  const params = useParams<{ id: string }>();
  const agronomistId = params.id;
  const { data, isLoading, isError } = useAdminAgronomistDetail(agronomistId);
  const { data: plans } = usePlans();

  if (isLoading) {
    return (
      <>
        <Link
          href="/admin/agronomists"
          className="mb-4 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
        >
          ← Voltar
        </Link>
        <PageHeader title="Agrônomo" description="Carregando…" />
        <div className="mt-6 space-y-6">
          <TableRowsSkeleton rows={4} columns={4} />
          <TableRowsSkeleton rows={6} columns={4} />
        </div>
      </>
    );
  }

  if (isError || !data) {
    return (
      <>
        <Link
          href="/admin/agronomists"
          className="mb-4 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
        >
          ← Voltar
        </Link>
        <p className="text-sm text-red-600 p-6">Agrônomo não encontrado.</p>
      </>
    );
  }

  const planName = plans?.find((p) => p.id === data.plan_id)?.name ?? data.plan_id;

  const farmRows = data.farms.map((f) => [
    f.name,
    f.location ?? "—",
    String(f.plot_count),
    new Date(f.created_at).toLocaleDateString("pt-BR"),
  ]);

  const producerRows = data.producers.map((p) => [
    <Link
      key={p.producer_id}
      href={`/admin/producers/${p.producer_id}`}
      className="font-medium text-primary hover:underline"
    >
      {p.name || "—"}
    </Link>,
    p.email,
    p.is_active ? <Badge variant="default">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>,
  ]);

  return (
    <>
      <Link
        href="/admin/agronomists"
        className="mb-4 flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
      >
        ← Voltar
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title={data.name} description={data.email} />
        {data.is_active ? (
          <Badge variant="default">Conta ativa</Badge>
        ) : (
          <Badge variant="secondary">Conta inativa</Badge>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fazendas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data.counts.farms}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Produtores</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data.counts.producers}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Safras</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data.counts.seasons}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Convites pendentes</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{data.counts.pending_invitations}</CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dados do consultor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">ID</span>
              <span className="font-mono text-xs text-right break-all">{data.user_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plano</span>
              <span className="font-medium">{planName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Início do plano</span>
              <span className="font-medium">
                {new Date(data.plan_started_at).toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Talhões ativos (armazenado)</span>
              <span className="font-medium">{data.active_plots_count}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-3">Fazendas cadastradas</h2>
          {data.farms.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma fazenda.</p>
          ) : (
            <DataTable headers={["Nome", "Localização", "Talhões", "Criada em"]} rows={farmRows} />
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3">Produtores vinculados</h2>
          {data.producers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum produtor.</p>
          ) : (
            <DataTable headers={["Nome", "E-mail", "Conta"]} rows={producerRows} />
          )}
        </div>
      </div>
    </>
  );
}
