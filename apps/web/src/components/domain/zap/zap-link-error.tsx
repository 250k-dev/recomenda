import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@recomenda/ui/primitives/card";

export function ZapLinkError({
  status,
  message,
}: {
  status: number;
  message: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-4 py-12">
      <Card className="w-full max-w-lg border-destructive/40 shadow-sm ring-1 ring-foreground/5">
        <CardHeader>
          <CardTitle className="text-destructive">
            {status === 410 ? "Link expirado" : "Não foi possível abrir"}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
