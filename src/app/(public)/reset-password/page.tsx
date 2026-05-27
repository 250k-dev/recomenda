import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-1 items-center justify-center p-4 py-12">
      <Card className="w-full max-w-lg shadow-sm ring-1 ring-foreground/5">
        <CardHeader>
          <CardTitle className="text-xl tracking-tight">Redefinir senha</CardTitle>
          <CardDescription>Fluxo público para tokens de recuperação enviados por e-mail.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground leading-relaxed">
          Use o token válido da sua mensagem para completar a redefinição pela API de autenticação.
        </CardContent>
      </Card>
    </div>
  );
}
