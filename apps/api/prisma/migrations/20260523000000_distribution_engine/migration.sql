-- Phase 6 — Lead Distribution Engine schema changes.

-- Round-robin tiebreak: when an order was last served a lead.
ALTER TABLE "orders" ADD COLUMN "last_served_at" TIMESTAMPTZ(6);

-- Delivery mode denormalised onto each assignment (backs the partial index).
ALTER TABLE "lead_assignments" ADD COLUMN "delivery_mode" "DeliveryMode" NOT NULL;

-- A lead may be billed/delivered to a given order at most once.
CREATE UNIQUE INDEX "lead_assignments_lead_id_order_id_key"
  ON "lead_assignments" ("lead_id", "order_id");

-- HARD CONSTRAINT: an EXCLUSIVE lead can have exactly one assignment.
-- A partial unique index lets the database reject a second exclusive
-- assignment for the same lead even if application code is bypassed.
CREATE UNIQUE INDEX "lead_assignments_exclusive_lead_key"
  ON "lead_assignments" ("lead_id")
  WHERE "delivery_mode" = 'EXCLUSIVE';

-- HARD CONSTRAINT: a SHARED lead can have at most four assignments.
-- Enforced as a trigger because a partial unique index cannot express
-- "at most N". The distribution engine locks the lead row, so the count
-- read here is never racy in practice; this is the database backstop.
CREATE OR REPLACE FUNCTION enforce_shared_assignment_cap()
RETURNS trigger AS $$
BEGIN
  IF NEW."delivery_mode" = 'SHARED' THEN
    IF (
      SELECT count(*) FROM "lead_assignments"
      WHERE "lead_id" = NEW."lead_id" AND "delivery_mode" = 'SHARED'
    ) >= 4 THEN
      RAISE EXCEPTION 'shared lead % already has 4 assignments', NEW."lead_id"
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lead_assignments_shared_cap
  BEFORE INSERT ON "lead_assignments"
  FOR EACH ROW EXECUTE FUNCTION enforce_shared_assignment_cap();
