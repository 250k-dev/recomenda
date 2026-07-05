"use client";

import { useEffect } from "react";

/**
 * Rascunho local (localStorage) para telas de criação — evita perder o progresso
 * ao recarregar, perder internet ou sair sem querer. Reutilizável entre a lista de
 * compra, a safra e a recomendação. Não substitui o salvar de verdade; some quando
 * o registro é criado (chamar `clearLocalDraft` no sucesso).
 */

export function readLocalDraft<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeLocalDraft<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage cheio/indisponível — ignora
  }
}

export function clearLocalDraft(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignora
  }
}

/** Autosalva `value` em localStorage (com debounce) enquanto `enabled` for true. */
export function useLocalDraft<T>(key: string, value: T, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const id = setTimeout(() => writeLocalDraft(key, value), 400);
    return () => clearTimeout(id);
  }, [key, value, enabled]);
}
