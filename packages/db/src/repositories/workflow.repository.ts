import type { ProjectDatabase } from "../project-database.js";

export interface WorkOrderRecord {
  readonly id: string;
  readonly projectId: string;
  readonly type: string;
  readonly status: string;
  readonly title: string;
  readonly description: string | null;
}

export interface WorkflowRunRecord {
  readonly id: string;
  readonly projectId: string;
  readonly workOrderId: string | null;
  readonly workflowName: string;
  readonly status: string;
  readonly input: Record<string, unknown>;
}

export interface WorkflowRunStepRecord {
  readonly id: string;
  readonly projectId: string;
  readonly workflowRunId: string;
  readonly name: string;
  readonly status: string;
}

export interface CreateWorkOrderRecordInput {
  readonly workOrderId: string;
  readonly projectId: string;
  readonly type: string;
  readonly title: string;
  readonly description?: string;
  readonly now?: number;
}

export interface PersistWorkflowRunInput {
  readonly projectId: string;
  readonly workOrderId?: string;
  readonly runId: string;
  readonly workflowName: string;
  readonly status: string;
  readonly input: Record<string, unknown>;
  readonly output?: Record<string, unknown>;
  readonly steps: readonly PersistWorkflowStepInput[];
  readonly now?: number;
}

export interface PersistWorkflowStepInput {
  readonly stepId: string;
  readonly workflowRunId: string;
  readonly projectId: string;
  readonly name: string;
  readonly status: string;
  readonly input?: Record<string, unknown>;
  readonly output?: Record<string, unknown>;
  readonly error?: string;
}

interface WorkOrderRow {
  readonly id: string;
  readonly project_id: string;
  readonly type: string;
  readonly status: string;
  readonly title: string;
  readonly description: string | null;
}

interface WorkflowRunRow {
  readonly id: string;
  readonly project_id: string;
  readonly work_order_id: string | null;
  readonly workflow_name: string;
  readonly status: string;
  readonly input: string | null;
}

export class WorkflowRepository {
  constructor(private readonly projectDatabase: ProjectDatabase) {}

  createWorkOrder(input: CreateWorkOrderRecordInput): WorkOrderRecord {
    const now = input.now ?? Date.now();
    this.projectDatabase.client
      .prepare(`
        insert into work_orders (
          id, project_id, type, status, title, description, created_by, created_at, updated_at
        )
        values (
          @workOrderId, @projectId, @type, 'queued', @title, @description, 'user', @now, @now
        )
      `)
      .run({
        description: input.description ?? null,
        now,
        projectId: input.projectId,
        title: input.title,
        type: input.type,
        workOrderId: input.workOrderId,
      });

    const row = this.projectDatabase.client
      .prepare("select * from work_orders where project_id = ? and id = ?")
      .get(input.projectId, input.workOrderId) as WorkOrderRow | undefined;

    if (!row) {
      throw new Error(`WORK_ORDER_NOT_CREATED: ${input.workOrderId}`);
    }

    return mapWorkOrderRow(row);
  }

  updateWorkOrderStatus(projectId: string, workOrderId: string, status: string): WorkOrderRecord {
    const now = Date.now();
    this.projectDatabase.client
      .prepare("update work_orders set status = ?, updated_at = ? where project_id = ? and id = ?")
      .run(status, now, projectId, workOrderId);

    const row = this.projectDatabase.client
      .prepare("select * from work_orders where project_id = ? and id = ?")
      .get(projectId, workOrderId) as WorkOrderRow | undefined;

    if (!row) {
      throw new Error(`WORK_ORDER_NOT_FOUND: ${workOrderId}`);
    }

    return mapWorkOrderRow(row);
  }

  getWorkOrder(projectId: string, workOrderId: string): WorkOrderRecord | undefined {
    const row = this.projectDatabase.client
      .prepare("select * from work_orders where project_id = ? and id = ?")
      .get(projectId, workOrderId) as WorkOrderRow | undefined;

    return row ? mapWorkOrderRow(row) : undefined;
  }

  listWorkOrders(input: {
    readonly projectId: string;
    readonly status?: string;
    readonly limit?: number;
  }): WorkOrderRecord[] {
    if (input.status) {
      return this.projectDatabase.client
        .prepare(
          `
          select * from work_orders
          where project_id = ? and status = ?
          order by updated_at desc
          limit ?
          `,
        )
        .all(input.projectId, input.status, input.limit ?? 100)
        .map((row) => mapWorkOrderRow(row as WorkOrderRow));
    }

    return this.projectDatabase.client
      .prepare(
        `
        select * from work_orders
        where project_id = ?
        order by updated_at desc
        limit ?
        `,
      )
      .all(input.projectId, input.limit ?? 100)
      .map((row) => mapWorkOrderRow(row as WorkOrderRow));
  }

  persistWorkflowRun(input: PersistWorkflowRunInput): WorkflowRunRecord {
    const now = input.now ?? Date.now();
    const persist = this.projectDatabase.client.transaction(() => {
      this.projectDatabase.client
        .prepare(`
          insert into workflow_runs (
            id, project_id, work_order_id, workflow_name, status, input, output,
            started_at, completed_at, created_at, updated_at
          )
          values (
            @runId, @projectId, @workOrderId, @workflowName, @status, @input, @output,
            @now, @completedAt, @now, @now
          )
          on conflict(id) do update set
            status = excluded.status,
            output = excluded.output,
            completed_at = excluded.completed_at,
            updated_at = excluded.updated_at
        `)
        .run({
          completedAt: input.status === "completed" || input.status === "failed" || input.status === "canceled"
            ? now
            : null,
          input: JSON.stringify(input.input),
          now,
          output: input.output === undefined ? null : JSON.stringify(input.output),
          projectId: input.projectId,
          runId: input.runId,
          status: input.status,
          workflowName: input.workflowName,
          workOrderId: input.workOrderId ?? null,
        });

      this.projectDatabase.client
        .prepare("delete from workflow_steps where project_id = ? and workflow_run_id = ?")
        .run(input.projectId, input.runId);

      for (const step of input.steps) {
        this.projectDatabase.client
          .prepare(`
            insert into workflow_steps (
              id, project_id, workflow_run_id, name, status, input, output, error, created_at
            )
            values (
              @stepId, @projectId, @workflowRunId, @name, @status, @input, @output, @error, @now
            )
          `)
          .run({
            error: step.error ?? null,
            input: step.input === undefined ? null : JSON.stringify(step.input),
            name: step.name,
            now,
            output: step.output === undefined ? null : JSON.stringify(step.output),
            projectId: step.projectId,
            status: step.status,
            stepId: step.stepId,
            workflowRunId: step.workflowRunId,
          });
      }
    });

    persist();

    const run = this.getWorkflowRun(input.projectId, input.runId);
    if (!run) {
      throw new Error(`WORKFLOW_RUN_NOT_CREATED: ${input.runId}`);
    }

    return run;
  }

  getWorkflowRun(projectId: string, workflowRunId: string): WorkflowRunRecord | undefined {
    const row = this.projectDatabase.client
      .prepare("select * from workflow_runs where project_id = ? and id = ?")
      .get(projectId, workflowRunId) as WorkflowRunRow | undefined;

    return row ? mapWorkflowRunRow(row) : undefined;
  }

  cancelWorkflowRun(projectId: string, workflowRunId: string): WorkflowRunRecord {
    const now = Date.now();
    this.projectDatabase.client
      .prepare(
        "update workflow_runs set status = 'canceled', completed_at = ?, updated_at = ? where project_id = ? and id = ?",
      )
      .run(now, now, projectId, workflowRunId);

    const run = this.getWorkflowRun(projectId, workflowRunId);
    if (!run) {
      throw new Error(`WORKFLOW_RUN_NOT_FOUND: ${workflowRunId}`);
    }

    if (run.workOrderId) {
      this.updateWorkOrderStatus(projectId, run.workOrderId, "canceled");
    }

    return run;
  }
}

function mapWorkOrderRow(row: WorkOrderRow): WorkOrderRecord {
  return {
    description: row.description,
    id: row.id,
    projectId: row.project_id,
    status: row.status,
    title: row.title,
    type: row.type,
  };
}

function mapWorkflowRunRow(row: WorkflowRunRow): WorkflowRunRecord {
  return {
    id: row.id,
    input: parseRecord(row.input),
    projectId: row.project_id,
    status: row.status,
    workflowName: row.workflow_name,
    workOrderId: row.work_order_id,
  };
}

function parseRecord(value: string | null): Record<string, unknown> {
  if (!value) {
    return {};
  }
  const parsed = JSON.parse(value) as unknown;
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}
