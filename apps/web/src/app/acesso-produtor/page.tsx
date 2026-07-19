"use client";

import { useRouter } from "next/navigation";
import { ShieldOff } from "lucide-react";

import { Button } from "@recomenda/ui/button";
import { logout } from "@recomenda/api/auth";

export default function ProducerOnlyPage() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      /* ignore */
    }
    router.push("/login?force=1");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4">
      <div className="mx-auto flex max-w-md flex-col items-center text-center animate-fade-in">
        <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldOff className="h-7 w-7" />
        </span>
        <h1 className="mb-2 text-2xl font-semibold text-foreground">Acesso negado</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Contas de produtor não têm acesso ao painel web neste momento. Entre em
          contato com o agrônomo responsável ou com o suporte.
        </p>
        <Button onClick={handleLogout} className="w-full">
          Sair e voltar ao login
        </Button>
      </div>
    </div>
  );
}
