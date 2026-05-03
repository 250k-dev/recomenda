import { Card } from "@/components/ui/card";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-100 p-4">
      <Card className="w-full max-w-lg">
        <h1 className="text-lg font-semibold">Redefinir senha</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Fluxo público para tokens de recuperação.
        </p>
      </Card>
    </div>
  );
}
