-- CreateEnum
CREATE TYPE "SampleRequestStatus" AS ENUM ('PENDING', 'FORWARDED', 'ASSIGNED', 'REJECTED');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "in_sample_pool" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "sample_requests" (
    "id" UUID NOT NULL,
    "public_id" TEXT NOT NULL,
    "client_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "lead_type" "LeadType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "delivery_mode" "DeliveryMode" NOT NULL,
    "state_filter" TEXT,
    "zip_filter" TEXT,
    "notes" TEXT,
    "status" "SampleRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reject_reason" TEXT,
    "reviewed_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sample_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sample_deliveries" (
    "id" UUID NOT NULL,
    "sample_request_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "assigned_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sample_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sample_requests_public_id_key" ON "sample_requests"("public_id");

-- CreateIndex
CREATE INDEX "sample_requests_client_id_idx" ON "sample_requests"("client_id");

-- CreateIndex
CREATE INDEX "sample_requests_agent_id_idx" ON "sample_requests"("agent_id");

-- CreateIndex
CREATE INDEX "sample_requests_status_lead_type_idx" ON "sample_requests"("status", "lead_type");

-- CreateIndex
CREATE INDEX "sample_deliveries_sample_request_id_idx" ON "sample_deliveries"("sample_request_id");

-- CreateIndex
CREATE INDEX "sample_deliveries_client_id_idx" ON "sample_deliveries"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "sample_deliveries_sample_request_id_lead_id_key" ON "sample_deliveries"("sample_request_id", "lead_id");

-- AddForeignKey
ALTER TABLE "sample_requests" ADD CONSTRAINT "sample_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_requests" ADD CONSTRAINT "sample_requests_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_requests" ADD CONSTRAINT "sample_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_deliveries" ADD CONSTRAINT "sample_deliveries_sample_request_id_fkey" FOREIGN KEY ("sample_request_id") REFERENCES "sample_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_deliveries" ADD CONSTRAINT "sample_deliveries_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_deliveries" ADD CONSTRAINT "sample_deliveries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_deliveries" ADD CONSTRAINT "sample_deliveries_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
