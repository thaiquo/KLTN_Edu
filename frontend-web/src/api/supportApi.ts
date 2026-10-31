// @ts-ignore plain JavaScript transport shared by the web application.
import { apiRequest } from "./client";

export type TicketStatus = "OPEN" | "ASSIGNED" | "WAITING_USER" | "WAITING_STAFF" | "ESCALATED" | "RESOLVED" | "CLOSED";
export interface TicketSummary {
  id: string; category: string; subject: string; status: TicketStatus;
  creatorId: number; creatorName: string; creatorRole: string;
  assigneeId: number | null; assigneeName: string | null;
  escalatedAt: string | null; createdAt: string; updatedAt: string; version: number;
}
export interface TicketDetail {
  summary: TicketSummary;
  description: string;
  messages: Array<{ id: number; actorId: number; actorName: string; actorRole: string; message: string; createdAt: string }>;
  history: Array<{ id: number; actorId: number; actorName: string; actorRole: string; action: string; fromStatus: string | null; toStatus: string | null; reason: string | null; createdAt: string }>;
}

const supportApi = {
  list(params: { status?: string; keyword?: string; page?: number; size?: number } = {}): Promise<any> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => value !== undefined && value !== "" && query.set(key, String(value)));
    return apiRequest(`/api/support/tickets?${query.toString()}`);
  },
  get(id: string): Promise<TicketDetail> { return apiRequest(`/api/support/tickets/${id}`); },
  create(payload: { category: string; subject: string; description: string }): Promise<TicketDetail> {
    return apiRequest("/api/support/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  },
  claim(id: string): Promise<TicketDetail> { return apiRequest(`/api/support/tickets/${id}/claim`, { method: "POST" }); },
  reply(id: string, message: string): Promise<TicketDetail> {
    return apiRequest(`/api/support/tickets/${id}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
  },
  status(id: string, status: TicketStatus, reason?: string): Promise<TicketDetail> {
    return apiRequest(`/api/support/tickets/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, reason }) });
  },
  escalate(id: string, reason: string): Promise<TicketDetail> {
    return apiRequest(`/api/support/tickets/${id}/escalate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
  },
};
export default supportApi;
