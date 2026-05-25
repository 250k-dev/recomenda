"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function SeasonsNewRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const farmId = searchParams.get("farm_id");
    const producerId = searchParams.get("producer_id");

    if (farmId) {
      const query = producerId
        ? `?producer_id=${encodeURIComponent(producerId)}`
        : "";
      router.replace(`/farms/${farmId}/season/new${query}`);
      return;
    }

    router.replace("/producers");
  }, [router, searchParams]);

  return null;
}
