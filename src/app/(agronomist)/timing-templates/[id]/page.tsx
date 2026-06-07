import { redirect } from "next/navigation";

export default async function LegacyTimingTemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;
  redirect("/producers");
}
