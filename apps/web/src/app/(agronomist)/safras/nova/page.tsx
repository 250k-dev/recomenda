"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { routes } from "@recomenda/config";

export default function SeasonsNewRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const farmId = searchParams.get("farm_id");
    const producerId = searchParams.get("producer_id");

    if (farmId) {
      router.replace(
        routes.fazendas.novaSafra(farmId, { producer_id: producerId }),
      );
      return;
    }

    router.replace(routes.produtores.lista);
  }, [router, searchParams]);

  return null;
}
