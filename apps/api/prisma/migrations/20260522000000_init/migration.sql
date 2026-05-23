-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'AGENT', 'CLIENT');

-- CreateEnum
CREATE TYPE "LeadType" AS ENUM ('SOLAR', 'SWEEPSTAKES', 'PAYDAY', 'HOMEOWNER');

-- CreateEnum
CREATE TYPE "DeliveryMode" AS ENUM ('EXCLUSIVE', 'SHARED');

-- CreateEnum
CREATE TYPE "LeadState" AS ENUM ('NEW', 'VALIDATING', 'VALID', 'REJECTED', 'MATCHING', 'UNSOLD_POOL', 'ASSIGNED', 'DELIVERED', 'ACCEPTED', 'REPLACEMENT_REQUESTED', 'REPLACED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RejectReason" AS ENUM ('INVALID_FORMAT', 'UNDELIVERABLE', 'DUPLICATE', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'REQUESTED', 'ACCEPTED', 'REJECTED', 'INVOICED', 'PAID', 'ACTIVE', 'FULFILLING', 'COMPLETED', 'PAUSED', 'CANCELLED', 'PAYMENT_FAILED');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "ReplacementStatus" AS ENUM ('REQUESTED', 'REVIEW', 'APPROVED', 'DENIED', 'REPLACED');

-- CreateEnum
CREATE TYPE "TxnType" AS ENUM ('CHARGE', 'REFUND');

-- CreateEnum
CREATE TYPE "TxnStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "LandingStatus" AS ENUM ('WORKING', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "CampaignAdsType" AS ENUM ('FACEBOOK', 'GOOGLE', 'TIKTOK', 'YOUTUBE', 'OTHER');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "full_name" TEXT NOT NULL,
    "work_email" TEXT NOT NULL,
    "phone" TEXT,
    "whatsapp" TEXT,
    "password_hash" TEXT NOT NULL,
    "designation" TEXT,
    "employee_id" TEXT,
    "linkedin_url" TEXT,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "business_name" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "whatsapp" TEXT,
    "address" TEXT,
    "password_hash" TEXT NOT NULL,
    "stripe_customer_id" TEXT,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "details" TEXT,
    "ads_type" "CampaignAdsType" NOT NULL,
    "production_link" TEXT,
    "budget" DECIMAL(12,2),
    "day_count" INTEGER,
    "results" JSONB,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_pages" (
    "id" UUID NOT NULL,
    "lead_type" "LeadType" NOT NULL,
    "name" TEXT NOT NULL,
    "web_link" TEXT,
    "status" "LandingStatus" NOT NULL DEFAULT 'WORKING',
    "field_map" JSONB,
    "intake_secret" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "landing_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "public_lead_id" TEXT NOT NULL,
    "campaign_id" UUID,
    "landing_page_id" UUID,
    "lead_type" "LeadType" NOT NULL,
    "source_url" TEXT,
    "submission_id" TEXT NOT NULL,
    "country" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "full_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "qualification" JSONB,
    "consent_text" TEXT,
    "consent_ip" TEXT,
    "consent_at" TIMESTAMPTZ(6),
    "lead_state" "LeadState" NOT NULL DEFAULT 'NEW',
    "reject_reason" "RejectReason",
    "captured_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "public_order_id" TEXT NOT NULL,
    "client_id" UUID NOT NULL,
    "lead_type" "LeadType" NOT NULL,
    "criteria" JSONB,
    "delivery_mode" "DeliveryMode" NOT NULL,
    "quantity_paid" INTEGER NOT NULL,
    "quantity_remaining" INTEGER NOT NULL,
    "daily_cap" INTEGER,
    "queue_priority" INTEGER NOT NULL DEFAULT 0,
    "freshness_required" INTEGER,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "requirements" TEXT,
    "reject_note" TEXT,
    "approved_by" UUID,
    "stripe_invoice_id" TEXT,
    "stripe_payment_link" TEXT,
    "requested_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_assignments" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "assignment_type" "AssignmentType" NOT NULL,
    "assigned_by" UUID,
    "delivery_method" TEXT,
    "delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "delivered_at" TIMESTAMPTZ(6),
    "revenue" DECIMAL(10,2),
    "replacement_code" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lead_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replacements" (
    "id" UUID NOT NULL,
    "original_lead_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "reason" TEXT,
    "status" "ReplacementStatus" NOT NULL DEFAULT 'REQUESTED',
    "reviewed_by" UUID,
    "replacement_lead_id" UUID,
    "replacement_code" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "replacements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "stripe_payment_id" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "type" "TxnType" NOT NULL,
    "status" "TxnStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "issued_at" TIMESTAMPTZ(6),
    "pdf_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppression_list" (
    "id" UUID NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "reason" TEXT,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "suppression_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "rate" DECIMAL(5,4) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "campaign_id" UUID,
    "incurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "key_prefix" TEXT,
    "encrypted_value" TEXT NOT NULL,
    "last_used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "config" JSONB,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_work_email_key" ON "users"("work_email");

-- CreateIndex
CREATE UNIQUE INDEX "clients_email_key" ON "clients"("email");

-- CreateIndex
CREATE INDEX "clients_agent_id_idx" ON "clients"("agent_id");

-- CreateIndex
CREATE INDEX "campaigns_created_by_idx" ON "campaigns"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "leads_public_lead_id_key" ON "leads"("public_lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "leads_submission_id_key" ON "leads"("submission_id");

-- CreateIndex
CREATE INDEX "leads_lead_type_country_state_idx" ON "leads"("lead_type", "country", "state");

-- CreateIndex
CREATE INDEX "leads_phone_idx" ON "leads"("phone");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- CreateIndex
CREATE INDEX "leads_lead_state_idx" ON "leads"("lead_state");

-- CreateIndex
CREATE UNIQUE INDEX "orders_public_order_id_key" ON "orders"("public_order_id");

-- CreateIndex
CREATE INDEX "orders_status_lead_type_idx" ON "orders"("status", "lead_type");

-- CreateIndex
CREATE INDEX "orders_queue_priority_paid_at_idx" ON "orders"("queue_priority", "paid_at");

-- CreateIndex
CREATE INDEX "orders_client_id_idx" ON "orders"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_assignments_replacement_code_key" ON "lead_assignments"("replacement_code");

-- CreateIndex
CREATE INDEX "lead_assignments_lead_id_idx" ON "lead_assignments"("lead_id");

-- CreateIndex
CREATE INDEX "lead_assignments_order_id_idx" ON "lead_assignments"("order_id");

-- CreateIndex
CREATE INDEX "lead_assignments_client_id_idx" ON "lead_assignments"("client_id");

-- CreateIndex
CREATE INDEX "replacements_original_lead_id_idx" ON "replacements"("original_lead_id");

-- CreateIndex
CREATE INDEX "replacements_order_id_idx" ON "replacements"("order_id");

-- CreateIndex
CREATE INDEX "replacements_client_id_idx" ON "replacements"("client_id");

-- CreateIndex
CREATE INDEX "transactions_order_id_idx" ON "transactions"("order_id");

-- CreateIndex
CREATE INDEX "transactions_client_id_idx" ON "transactions"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_order_id_idx" ON "invoices"("order_id");

-- CreateIndex
CREATE INDEX "invoices_client_id_idx" ON "invoices"("client_id");

-- CreateIndex
CREATE INDEX "suppression_list_phone_idx" ON "suppression_list"("phone");

-- CreateIndex
CREATE INDEX "suppression_list_email_idx" ON "suppression_list"("email");

-- CreateIndex
CREATE INDEX "commissions_agent_id_idx" ON "commissions"("agent_id");

-- CreateIndex
CREATE INDEX "commissions_order_id_idx" ON "commissions"("order_id");

-- CreateIndex
CREATE INDEX "expenses_campaign_id_idx" ON "expenses"("campaign_id");

-- CreateIndex
CREATE INDEX "audit_log_actor_user_id_idx" ON "audit_log"("actor_user_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_idx" ON "audit_log"("entity", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_provider_key" ON "integrations"("provider");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_landing_page_id_fkey" FOREIGN KEY ("landing_page_id") REFERENCES "landing_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replacements" ADD CONSTRAINT "replacements_original_lead_id_fkey" FOREIGN KEY ("original_lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replacements" ADD CONSTRAINT "replacements_replacement_lead_id_fkey" FOREIGN KEY ("replacement_lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replacements" ADD CONSTRAINT "replacements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replacements" ADD CONSTRAINT "replacements_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replacements" ADD CONSTRAINT "replacements_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

