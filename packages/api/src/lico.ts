import { api } from "./http/axios";

export type LicoRosterPerson = {
  userId: string;
  name: string;
  role: "agronomist" | "team" | "producer";
  phone: string | null;
  whatsappLinked: boolean;
};

export type LicoRoster = {
  enabled: boolean;
  source: "off" | "premium" | "addon";
  planName: string;
  people: LicoRosterPerson[];
};

export async function getLicoRoster() {
  const { data } = await api.get<LicoRoster>("/agronomists/me/lico");
  return data;
}
