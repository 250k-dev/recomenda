"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Check,
  User,
  Building2,
  Sprout,
  ArrowLeft,
  ArrowRight,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createProducer,
  createFarm,
  createPlot,
  grantFarmAccess,
} from "@/lib/api/client";
import { cn } from "@/lib/utils";

type Producer = { id: string; name: string };
type Farm = { id: string; name: string };
type WizPlot = {
  id: string;
  name: string;
  area: number;
  farmId: string;
  farmName: string;
};
const STEPS = [
  { n: 1, label: "Produtor", icon: User },
  { n: 2, label: "Fazenda", icon: Building2 },
  { n: 3, label: "Talhão", icon: Sprout },
];

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export default function OnboardingPage() {
  const router = useRouter();
  // const sidebar = useSidebar();
  const [step, setStep] = useState(1);
  const [producer, setProducer] = useState<Producer | null>(null);
  const [currentFarm, setCurrentFarm] = useState<Farm | null>(null);
  const [allPlots, setAllPlots] = useState<WizPlot[]>([]);

  // const wasCollapsedRef = useRef<boolean | null>(null);

  // useEffect(() => {
  //   wasCollapsedRef.current = !sidebar.open;
  //   if (sidebar.open) {
  //     sidebar.setOpen(false);
  //   }

  //   return () => {
  //     if (wasCollapsedRef.current === false) {
  //       sidebar.setOpen(true);
  //     }
  //   };
  // }, []);

  return (
    <div className="-mx-4 -my-6 flex min-h-[calc(100vh-1px)] md:-mx-8 bg-background">
      <aside className="flex-col hidden w-64 gap-8 px-6 py-8 border-r shrink-0 bg-muted/40 lg:flex">
        <div>
          <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
            Onboarding
          </p>
          <h2 className="mt-2 text-base font-semibold leading-snug tracking-tight text-foreground">
            Cadastro do produtor
          </h2>
        </div>
        <ol className="flex flex-col">
          {STEPS.map((s) => {
            const state =
              s.n < step ? "done" : s.n === step ? "current" : "todo";
            const Icon = s.icon;
            return (
              <li
                key={s.n}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors",
                  state === "current" && "bg-card",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    state === "done" && "bg-primary text-primary-foreground",
                    state === "current" &&
                      "border-2 border-primary bg-background text-primary",
                    state === "todo" && "bg-muted text-muted-foreground",
                  )}
                >
                  {state === "done" ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </span>
                <p
                  className={cn(
                    "text-sm font-medium",
                    state === "todo" && "text-muted-foreground",
                    state === "current" && "text-foreground",
                    state === "done" && "text-foreground",
                  )}
                >
                  {s.label}
                </p>
              </li>
            );
          })}
        </ol>
      </aside>

      <section className="flex flex-col flex-1 min-w-0 px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full transition-all rounded-full bg-primary"
              style={{ width: `${(step / STEPS.length) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium shrink-0 tabular-nums text-muted-foreground">
            Passo {step} de {STEPS.length}
          </span>
        </div>

        {step === 1 && (
          <StepProducer
            onDone={(p) => {
              setProducer(p);
              setStep(2);
            }}
            onCancel={() => router.push("/producers")}
          />
        )}
        {step === 2 && producer && (
          <StepFarm
            producer={producer}
            onBack={() => setStep(allPlots.length > 0 ? 3 : 1)}
            onDone={(f) => {
              setCurrentFarm(f);
              setStep(3);
            }}
          />
        )}
        {step === 3 && producer && currentFarm && (
          <StepPlot
            producer={producer}
            farm={currentFarm}
            plots={allPlots.filter((p) => p.farmId === currentFarm.id)}
            onAddPlot={(p) => setAllPlots((prev) => [...prev, p])}
            onBack={() => setStep(2)}
            onAnotherFarm={() => setStep(2)}
            onFinish={() => router.push(`/producers/${producer.id}`)}
          />
        )}
      </section>
    </div>
  );
}

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h1>
      <p className="max-w-2xl mt-2 text-sm leading-relaxed text-muted-foreground">
        {subtitle}
      </p>
    </div>
  );
}

function Field({
  htmlFor,
  label,
  hint,
  children,
}: {
  htmlFor?: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-foreground">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="px-3 py-2 text-sm border rounded-md border-destructive/30 bg-destructive/5 text-destructive">
      {message}
    </div>
  );
}

function StepFooter({
  back,
  primary,
  secondary,
}: {
  back?: ReactNode;
  primary: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <div className="sticky bottom-0 px-4 py-4 mt-10 -mx-4 border-t bg-background/95 backdrop-blur sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
      <div className="flex flex-wrap items-center gap-2">
        {back}
        <div className="flex-1" />
        {secondary}
        {primary}
      </div>
    </div>
  );
}

function ContextBadge({
  tone,
  children,
}: {
  tone: "primary" | "sky";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "primary" && "bg-primary/10 text-primary",
        tone === "sky" && "bg-sky-100 text-sky-600",
      )}
    >
      {children}
    </span>
  );
}

function StepProducer({
  onDone,
  onCancel,
}: {
  onDone: (p: Producer) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createProducer,
    onSuccess: (p) => onDone({ id: p.id, name: p.name }),
    onError: (e: unknown) => setError(extractError(e)),
  });

  const submit = () => {
    setError(null);
    if (!name.trim()) return setError("Informe o nome do produtor.");
    mutation.mutate({
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
    });
  };

  return (
    <div className="flex flex-col flex-1">
      <StepHeader
        title="Comece pelo produtor"
        subtitle="Você não precisa enviar convite agora. O acesso ao app é opcional e pode ser ativado depois."
      />

      <div className="max-w-xl space-y-5">
        <Field htmlFor="name" label="Nome completo">
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: João da Silva"
            autoFocus
          />
        </Field>

        <Field htmlFor="phone" label="Telefone">
          <Input
            id="phone"
            value={phone}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "");
              if (value.length <= 11) {
                let formatted = value;
                if (value.length > 0) formatted = `(${value.slice(0, 2)}`;
                if (value.length > 2) formatted += `) ${value.slice(2, 7)}`;
                if (value.length > 7) formatted += `-${value.slice(7)}`;
                setPhone(formatted);
              }
            }}
            placeholder="(00) 00000-0000"
          />
        </Field>

        <Field htmlFor="email" label="E-mail (opcional)">
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="produtor@exemplo.com"
          />
        </Field>

        <FieldError message={error ?? undefined} />
      </div>

      <StepFooter
        back={
          <Button variant="ghost" onClick={onCancel} size="lg">
            Cancelar
          </Button>
        }
        primary={
          <Button
            onClick={submit}
            disabled={mutation.isPending}
            className="gap-2"
            size="lg"
          >
            {mutation.isPending ? "Salvando…" : "Próximo"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        }
      />
    </div>
  );
}

function StepFarm({
  producer,
  onBack,
  onDone,
}: {
  producer: Producer;
  onBack: () => void;
  onDone: (f: Farm) => void;
}) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const created = await createFarm({
        name: name.trim(),
        location: location.trim() || undefined,
      });
      await grantFarmAccess(created.id, producer.id);
      return created;
    },
    onSuccess: (f) => onDone({ id: f.id, name: f.name }),
    onError: (e: unknown) => setError(extractError(e)),
  });

  const submit = () => {
    setError(null);
    if (!name.trim()) return setError("Informe o nome da fazenda.");
    mutation.mutate();
  };

  return (
    <div className="flex flex-col flex-1">
      <StepHeader
        title="A fazenda do produtor"
        subtitle="Você pode adicionar mais fazendas depois. O total de hectares é a soma dos talhões."
      />

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <ContextBadge tone="primary">
          <Check className="h-3.5 w-3.5" />
          Produtor: <strong className="font-semibold">{producer.name}</strong>
        </ContextBadge>
      </div>

      <div className="max-w-xl space-y-5">
        <Field htmlFor="farm-name" label="Nome da fazenda">
          <Input
            id="farm-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Fazenda Santa Rosa"
            autoFocus
          />
        </Field>

        <Field
          htmlFor="farm-loc"
          label="Localização (opcional)"
          hint="Usado nos relatórios e na visualização da fazenda."
        >
          <Input
            id="farm-loc"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Cidade, UF"
          />
        </Field>

        <FieldError message={error ?? undefined} />
      </div>

      <StepFooter
        back={
          <Button variant="ghost" onClick={onBack} className="gap-2" size="lg">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
        }
        primary={
          <Button
            onClick={submit}
            disabled={mutation.isPending}
            className="gap-2"
            size="lg"
          >
            {mutation.isPending ? "Salvando…" : "Próximo"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        }
      />
    </div>
  );
}

function StepPlot({
  producer,
  farm,
  plots,
  onAddPlot,
  onBack,
  onAnotherFarm,
  onFinish,
}: {
  producer: Producer;
  farm: Farm;
  plots: WizPlot[];
  onAddPlot: (p: WizPlot) => void;
  onBack: () => void;
  onAnotherFarm: () => void;
  onFinish: () => void;
}) {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createPlot(farm.id, { name: name.trim(), area_hectares: Number(area) }),
    onSuccess: (p) => {
      onAddPlot({
        id: p.id,
        name: p.name,
        area: Number(area),
        farmId: farm.id,
        farmName: farm.name,
      });
      setName("");
      setArea("");
    },
    onError: (e: unknown) => setError(extractError(e)),
  });

  const submit = () => {
    setError(null);
    if (!name.trim()) return setError("Informe o nome do talhão.");
    const n = Number(area);
    if (!n || n <= 0) return setError("Informe os hectares do talhão.");
    mutation.mutate();
  };

  const totalHa = plots.reduce((s, p) => s + p.area, 0);

  return (
    <div className="flex flex-col flex-1">
      <StepHeader
        title="Mapeie os talhões"
        subtitle="Adicione quantos talhões quiser. O total de hectares da fazenda é a soma. A lista de compra e a safra são configuradas depois, dentro do produtor."
      />

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <ContextBadge tone="primary">
          <User className="h-3.5 w-3.5" />
          {producer.name}
        </ContextBadge>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        <ContextBadge tone="sky">
          <Building2 className="h-3.5 w-3.5" />
          {farm.name}
        </ContextBadge>
      </div>

      <div className="max-w-xl space-y-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <Field htmlFor="plot-name" label="Nome do talhão">
            <Input
              id="plot-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Talhão 1"
              autoFocus
            />
          </Field>
          <Field htmlFor="plot-area" label="Hectares">
            <Input
              id="plot-area"
              type="number"
              step="0.01"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="0"
            />
          </Field>
        </div>

        <FieldError message={error ?? undefined} />

        <Button
          variant="outline"
          onClick={submit}
          disabled={mutation.isPending}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          {mutation.isPending ? "Adicionando..." : "Adicionar talhão"}
        </Button>
      </div>

      {plots.length > 0 && (
        <div className="max-w-xl mt-8">
          <div className="flex items-center justify-between mb-2 text-xs font-semibold tracking-wide uppercase text-muted-foreground">
            <span>
              {farm.name} · {plots.length}{" "}
              {plots.length === 1 ? "talhão" : "talhões"}
            </span>
            <span>
              Total{" "}
              <strong className="text-foreground">{fmt(totalHa)} ha</strong>
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {plots.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 px-3 py-3 text-sm border rounded-lg shadow-sm bg-card"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-full shrink-0 bg-primary/10 text-primary">
                  <Check className="w-4 h-4" />
                </span>
                <span className="flex-1 min-w-0 font-medium truncate text-foreground">
                  {p.name}
                </span>
                <span className="shrink-0 tabular-nums text-foreground">
                  {fmt(p.area)} ha
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <StepFooter
        back={
          <Button variant="ghost" onClick={onBack} className="gap-2" size="lg">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
        }
        secondary={
          <Button
            variant="outline"
            onClick={onAnotherFarm}
            className="gap-2"
            size="lg"
          >
            <Building2 className="w-4 h-4" />
            Outra fazenda
          </Button>
        }
        primary={
          <Button
            onClick={onFinish}
            disabled={plots.length === 0}
            className="gap-2"
            size="lg"
          >
            <Check className="w-4 h-4" />
            Concluir cadastro
          </Button>
        }
      />
    </div>
  );
}

function extractError(e: unknown): string {
  if (e && typeof e === "object" && "response" in e) {
    const resp = (e as { response?: { data?: { message?: string } } }).response;
    if (resp?.data?.message) return resp.data.message;
  }
  if (e instanceof Error) return e.message;
  return "Não foi possível concluir. Tente novamente.";
}
