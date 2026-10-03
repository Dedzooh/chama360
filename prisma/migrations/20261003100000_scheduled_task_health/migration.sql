-- Persist the last outcome of recurring scheduler tasks for operations monitoring.
CREATE TABLE "scheduled_task_health" (
  "taskName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "lastStartedAt" TIMESTAMP(3),
  "lastCompletedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "scheduled_task_health_pkey" PRIMARY KEY ("taskName")
);
