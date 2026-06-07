"use client";

import { useSearchParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/domain/page-header";
import { MonthCalendar } from "@/components/domain/agenda/month-calendar";

export default function CronogramaPage() {
  const searchParams = useSearchParams();
  const producerId = searchParams.get("producer_id") ?? undefined;

  return (
    <>
      <PageHeader
        icon={<CalendarDays className="h-5 w-5" />}
        title={producerId ? "Cronograma do produtor" : "Cronograma geral"}
        description="Aplicações pendentes e atrasadas das safras ativas na sua carteira. Clique em um dia para ver os detalhes."
      />
      <MonthCalendar producerId={producerId} focusNearestEvent />
    </>
  );
}
