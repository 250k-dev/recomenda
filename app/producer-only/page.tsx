"use client";

import { Button } from "@/components/ui/button";
import { clearAccessToken } from "@/lib/auth/token-store";
import { useRouter } from "next/navigation";

export default function ProducerOnlyPage() {
  const router = useRouter();

  const handleLogout = () => {
    clearAccessToken();
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 text-5xl">🚫</div>
        <h1 className="mb-2 text-2xl font-bold text-red-600">Acesso negado</h1>
        <p className="mb-6 text-zinc-600">
          Produtores não podem acessar o painel administrativo. Use o <strong>Recomenda App</strong> para continuar.
        </p>
        <Button onClick={handleLogout} className="w-full">
          Fazer logout e retornar ao login
        </Button>
      </div>
    </div>
  );
}
