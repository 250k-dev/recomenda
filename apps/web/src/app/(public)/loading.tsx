import { Skeleton } from "@recomenda/ui/primitives/skeleton";

export default function PublicRoutesLoading() {
  return (
    <div
      className="mx-auto flex min-h-[50vh] w-full max-w-lg flex-col justify-center gap-4 px-4 py-16"
      aria-busy
      aria-label="Carregando"
    >
      <Skeleton className="h-9 w-[60%]" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-[80%]" />
      <Skeleton className="mt-4 h-11 w-full rounded-md" />
      <Skeleton className="h-11 w-full rounded-md" />
    </div>
  );
}
