"use client";

import { useState } from "react";
import { LocateFixed } from "lucide-react";
import { Button } from "@recomenda/ui/primitives/button";
import { Input } from "@recomenda/ui/primitives/input";
import { Label } from "@recomenda/ui/primitives/label";

type FarmCoordinatesFieldsProps = {
  latitude: string;
  longitude: string;
  onChange: (next: { latitude: string; longitude: string }) => void;
  idPrefix?: string;
};

/**
 * Ponto da sede da fazenda — é daqui que sai o clima do Lico (chuva, geada e janela de
 * pulverização). Sem ele, o clima usa o centro da cidade. Opcional: quem está na fazenda
 * toca em "Usar minha localização"; o pin enviado pelo WhatsApp também preenche.
 */
export function FarmCoordinatesFields({ latitude, longitude, onChange, idPrefix = "farm" }: FarmCoordinatesFieldsProps) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Este navegador não informa a localização.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onChange({ latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) });
      },
      () => {
        setLocating(false);
        setError("Não foi possível obter a localização (permissão negada?).");
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">Ponto da sede (opcional)</Label>
      <p className="text-xs text-muted-foreground">
        Usado pelo Lico para o clima e a janela de pulverização. Sem ele, vale o centro da cidade.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-lat`} className="text-xs font-semibold text-muted-foreground">
            Latitude
          </Label>
          <Input
            id={`${idPrefix}-lat`}
            inputMode="decimal"
            placeholder="-12,545678"
            value={latitude}
            onChange={(e) => onChange({ latitude: e.target.value, longitude })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-lng`} className="text-xs font-semibold text-muted-foreground">
            Longitude
          </Label>
          <Input
            id={`${idPrefix}-lng`}
            inputMode="decimal"
            placeholder="-55,712345"
            value={longitude}
            onChange={(e) => onChange({ latitude, longitude: e.target.value })}
          />
        </div>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={useMyLocation} disabled={locating}>
        <LocateFixed className="mr-1.5 h-4 w-4" />
        {locating ? "Localizando..." : "Usar minha localização"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

/** "-12,5" / "-12.5" → número; vazio ou inválido → null. */
export function parseCoordinate(value: string, max: number): number | null {
  const n = Number(value.trim().replace(",", "."));
  if (!value.trim() || !Number.isFinite(n) || Math.abs(n) > max) return null;
  return n;
}
