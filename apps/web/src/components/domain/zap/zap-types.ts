export type ZapLoadResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

export type ZapListItem = {
  id: string;
  productName: string;
  category: string;
  categoryLabel: string;
  quantity: number;
  doseUnit: string;
  dosePerHectare: number;
  nApplications: number;
  totalBrl: number;
};

export type ZapListDto = {
  typ: "list_edit";
  canWrite: boolean;
  showPrices: boolean;
  expiresAt: number;
  list: {
    id: string;
    name: string;
    crop: string;
    cropLabel?: string;
    totalHectares: number;
    items: ZapListItem[];
  };
};

export type ZapCatalogItem = {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  doseUnit: string;
};

export type ZapSeasonDto =
  | {
      typ: "season_create";
      step: "producer";
      expiresAt: number;
      producers: Array<{ id: string; name: string }>;
    }
  | {
      typ: "season_create";
      step: "farm";
      expiresAt: number;
      producerId: string;
      farms: Array<{ id: string; name: string }>;
    }
  | {
      typ: "season_create";
      step: "plot";
      expiresAt: number;
      producerId: string;
      farmId: string;
      plots: Array<{ id: string; name: string; areaHectares: number }>;
    };
