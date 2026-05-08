import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-4 py-12">
      <Card className="w-full max-w-lg shadow-sm ring-1 ring-foreground/5">
        <CardHeader>
          <CardTitle className="text-xl tracking-tight">Recuperação de senha</CardTitle>
          <CardDescription>
            Solicite este fluxo pela API <code className="rounded bg-muted px-1 py-0.5 text-xs">POST /auth/forgot-password</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed">
          Um link seguro será enviado ao e-mail cadastrado quando o backend estiver configurado para envio.
        </CardContent>
      </Card>
    </div>
  );
}
