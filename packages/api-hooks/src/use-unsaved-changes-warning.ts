"use client";

import { useEffect } from "react";

/**
 * Última rede de segurança contra perder trabalho: enquanto `enabled` for true,
 * o navegador pede confirmação ao tentar **fechar a aba, recarregar ou sair**
 * da página (evento nativo `beforeunload`). Combinado com o rascunho local
 * (localStorage), garante que horas de preenchimento não sumam por um clique
 * errado, reload ou queda de conexão.
 *
 * Obs.: cobre fechar/recarregar/navegação externa. A navegação interna do app
 * (links) já é coberta pelo rascunho local, que restaura o progresso ao voltar.
 */
export function useUnsavedChangesWarning(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Alguns navegadores ainda exigem returnValue definido.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [enabled]);
}
