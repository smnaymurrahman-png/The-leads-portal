-- Phase 8 — replacement workflow: reviewer note recorded on deny/approve.
ALTER TABLE "replacements" ADD COLUMN "review_note" TEXT;
