"use client";

import { useEffect, useRef, useState } from "react";

type EditMessage =
  | { type: "editing"; tabId: string }
  | { type: "idle"; tabId: string }
  | { type: "ping"; tabId: string }
  | { type: "pong-editing"; tabId: string };

/**
 * Detecta outra aba editando a mesma lista (BroadcastChannel + ping ao abrir).
 */
export function usePurchaseListEditChannel(listId: string | undefined, editing: boolean) {
  const tabIdRef = useRef(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `tab-${Date.now()}`,
  );
  const [remotePeerEditing, setRemotePeerEditing] = useState(false);

  useEffect(() => {
    if (!listId || typeof BroadcastChannel === "undefined") {
      setRemotePeerEditing(false);
      return;
    }
    const channel = new BroadcastChannel(`recomenda:pl-edit:${listId}`);
    const tabId = tabIdRef.current;

    const post = (type: EditMessage["type"]) => {
      channel.postMessage({ type, tabId } satisfies EditMessage);
    };

    const onMessage = (event: MessageEvent<EditMessage>) => {
      const msg = event.data;
      if (!msg || msg.tabId === tabId) return;
      if (msg.type === "editing" || msg.type === "pong-editing") {
        setRemotePeerEditing(true);
      }
      if (msg.type === "idle") {
        setRemotePeerEditing(false);
      }
      if (msg.type === "ping" && editing) {
        post("pong-editing");
      }
    };

    channel.addEventListener("message", onMessage);
    post("ping");
    if (editing) post("editing");
    else post("idle");

    return () => {
      post("idle");
      channel.removeEventListener("message", onMessage);
      channel.close();
    };
  }, [listId, editing]);

  return { remotePeerEditing };
}
