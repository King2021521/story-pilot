export type StoryPilotEventType =
  | "backend.ready"
  | "backend.unhealthy"
  | "workflow.started"
  | "workflow.step.started"
  | "workflow.step.completed"
  | "workflow.step.failed"
  | "workflow.token.delta"
  | "workflow.waiting_user"
  | "workflow.completed"
  | "workflow.failed"
  | "workflow.canceled"
  | "artifact.created"
  | "artifact.applied"
  | "memory.candidate.created"
  | "memory.confirmed"
  | "board.updated";

export type StoryPilotEvent<TPayload = unknown> = {
  id: string;
  type: StoryPilotEventType;
  projectId?: string;
  timestamp: number;
  payload: TPayload;
};

