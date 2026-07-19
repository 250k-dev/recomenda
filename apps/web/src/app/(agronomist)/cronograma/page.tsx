"use client";

import type { Route } from "next";
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MonthCalendar } from "@/components/domain/agenda/month-calendar";
import { useProducer } from "@recomenda/api-hooks";

export default function CronogramaPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const producerId = searchParams.get("producer_id") ?? undefined;
  const { data: producer } = useProducer(producerId ?? "");

  const handleProducerChange = useCallback(
    (nextProducerId: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextProducerId) params.set("producer_id", nextProducerId);
      else params.delete("producer_id");
      const query = params.toString();
      router.replace((query ? `${pathname}?${query}` : pathname) as Route);
    },
    [pathname, router, searchParams],
  );

  const calendarTitle = producer?.name ? `Cronograma · ${producer.name}` : "Cronograma";

  return (
    <MonthCalendar
      producerId={producerId}
      title={calendarTitle}
      showHeader
      showProducerFilter
      onProducerChange={handleProducerChange}
      focusNearestEvent
    />
  );
}
