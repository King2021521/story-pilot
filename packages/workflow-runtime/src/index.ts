export type WorkOrderStatus =
  | "queued"
  | "running"
  | "waiting_user"
  | "completed"
  | "failed"
  | "canceled";

export const TERMINAL_WORK_ORDER_STATUSES: ReadonlySet<WorkOrderStatus> = new Set([
  "completed",
  "failed",
  "canceled",
]);

