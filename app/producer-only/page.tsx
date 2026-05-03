import { Card } from "@/components/ui/card";

export default function ProducerOnlyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 p-4">
      <Card className="w-full max-w-lg">
        <h1 className="text-lg font-semibold">Use o aplicativo mobile</h1>
        <p className="mt-2 text-sm text-zinc-600">
          O acesso web é exclusivo para Admin e Agronomista.
        </p>
      </Card>
    </div>
  );
}
