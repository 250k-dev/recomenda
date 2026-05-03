import { Card } from "@/components/ui/card";

export default async function InviteTokenPage(props: {
  params: Promise<{ token: string }>;
}) {
  const params = await props.params;
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 p-4">
      <Card className="w-full max-w-lg">
        <h1 className="text-lg font-semibold">Convite de produtor</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Token recebido: <strong>{params.token}</strong>
        </p>
      </Card>
    </div>
  );
}
