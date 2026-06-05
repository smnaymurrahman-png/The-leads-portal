-- Delivery model change: a lead assigned to a client is delivered to their
-- account, so delivery + revenue are booked on assignment (the socket push is
-- now best-effort, not the delivery gate). Backfill the assignments that were
-- left PENDING/RETRYING/FAILED under the old ack-required model.

-- Mark every non-delivered assignment as delivered, stamp a delivery time, and
-- book its revenue from the order's unit price.
UPDATE "lead_assignments" AS la
SET "delivery_status" = 'DELIVERED',
    "delivered_at"    = COALESCE(la."delivered_at", now()),
    "revenue"         = COALESCE(la."revenue", o."unit_price"),
    "updated_at"      = now()
FROM "orders" AS o
WHERE la."order_id" = o."id"
  AND la."delivery_status" <> 'DELIVERED';

-- Advance the lead lifecycle for leads that are now delivered but still sitting
-- at ASSIGNED. Leaves REPLACEMENT_REQUESTED / REPLACED / ACCEPTED untouched.
UPDATE "leads"
SET "lead_state" = 'DELIVERED',
    "updated_at" = now()
WHERE "lead_state" = 'ASSIGNED'
  AND "id" IN (
    SELECT "lead_id" FROM "lead_assignments" WHERE "delivery_status" = 'DELIVERED'
  );
