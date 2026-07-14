import { api } from "@/lib/http/axios";

export interface Notification {
  id: string;
  user_id: string;
  type: "INVITATION" | "RECOMMENDATION_DUE" | "RECOMMENDATION_LATE" | "PRODUCT_SUBSTITUTED" | "SEASON_PUBLISHED" | "HARVEST_REGISTERED" | "TEAM_ACTIVITY";
  payload: Record<string, unknown>;
  read_at?: string | null;
  created_at: string;
}

export async function getNotifications() {
  const { data } = await api.get<{ data: Notification[] }>("/notifications");
  return data;
}

export async function markNotificationRead(id: string) {
  await api.post(`/notifications/${encodeURIComponent(id)}/read`);
}

export async function markAllNotificationsRead() {
  await api.post("/notifications/read-all");
}
