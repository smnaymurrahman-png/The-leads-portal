-- Phase 7 — real-time delivery: per-assignment delivery attempt counter
-- (drives the RETRYING → FAILED retry path).
ALTER TABLE "lead_assignments"
  ADD COLUMN "delivery_attempts" INTEGER NOT NULL DEFAULT 0;
