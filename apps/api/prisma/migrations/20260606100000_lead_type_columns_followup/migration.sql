-- Per-vertical lead sheets: editable follow-up status on each assignment, and
-- a DB-backed column-schema table (LeadTypeColumn) so admins can change the
-- columns shown per lead type without a deploy.

-- CreateEnum
CREATE TYPE "FollowupStatus" AS ENUM ('NEW', 'CALLED', 'NO_ANSWER', 'CONVERTED', 'DEAD');

-- AlterTable
ALTER TABLE "lead_assignments" ADD COLUMN     "followup_note" TEXT,
ADD COLUMN     "followup_status" "FollowupStatus" NOT NULL DEFAULT 'NEW',
ADD COLUMN     "followup_updated_at" TIMESTAMPTZ(6),
ADD COLUMN     "followup_updated_by" UUID;

-- CreateTable
CREATE TABLE "lead_type_columns" (
    "id" UUID NOT NULL,
    "lead_type" "LeadType" NOT NULL,
    "position" INTEGER NOT NULL,
    "field_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "data_type" TEXT NOT NULL DEFAULT 'string',
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "mask_kind" TEXT,
    "default_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lead_type_columns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_type_columns_lead_type_default_visible_idx" ON "lead_type_columns"("lead_type", "default_visible");

-- CreateIndex
CREATE UNIQUE INDEX "lead_type_columns_lead_type_position_key" ON "lead_type_columns"("lead_type", "position");

-- CreateIndex
CREATE UNIQUE INDEX "lead_type_columns_lead_type_field_key_key" ON "lead_type_columns"("lead_type", "field_key");

-- CreateIndex
CREATE INDEX "lead_assignments_client_id_followup_status_idx" ON "lead_assignments"("client_id", "followup_status");

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_followup_updated_by_fkey" FOREIGN KEY ("followup_updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the default per-vertical column schemas (admins can edit later).
INSERT INTO "lead_type_columns"
  ("id","lead_type","position","field_key","label","source","data_type","sensitive","mask_kind","default_visible","created_at","updated_at")
VALUES
  (gen_random_uuid(), 'SOLAR', 1, 'lead_id', 'Lead ID', 'system.public_lead_id', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SOLAR', 2, 'status', 'Status', 'assignment.delivery_status', 'enum', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SOLAR', 3, 'captured', 'Captured', 'system.captured_at', 'datetime', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SOLAR', 4, 'delivered', 'Delivered', 'assignment.delivered_at', 'datetime', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SOLAR', 5, 'order', 'Order', 'order.public_order_id', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SOLAR', 6, 'source', 'Source', 'system.landing_page', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SOLAR', 7, 'replacement', 'Replacement', 'replacement.status', 'enum', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SOLAR', 8, 'followup', 'Follow-up', 'assignment.followup_status', 'enum', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SOLAR', 9, 'home_address', 'Home Address', 'lead.address', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SOLAR', 10, 'property_type', 'Residential/Commercial', 'qualification.property_type', 'enum', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SOLAR', 11, 'monthly_bill', 'Utility Bill', 'qualification.monthly_bill', 'money', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SOLAR', 12, 'roof_type', 'Roof Type', 'qualification.roof_type', 'enum', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SOLAR', 13, 'credit_score', 'Credit Score', 'qualification.credit_score', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SOLAR', 14, 'own_home', 'Own Home?', 'qualification.own_home', 'enum', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SOLAR', 15, 'home_age', 'Home Age', 'qualification.home_age', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SOLAR', 16, 'full_name', 'Full Name', 'lead.full_name', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SOLAR', 17, 'email', 'Email Address', 'lead.email', 'email', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SOLAR', 18, 'phone', 'Phone Number', 'lead.phone', 'phone', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SOLAR', 19, 'zip', 'ZIP', 'lead.zip', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SWEEPSTAKES', 1, 'lead_id', 'Lead ID', 'system.public_lead_id', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SWEEPSTAKES', 2, 'status', 'Status', 'assignment.delivery_status', 'enum', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SWEEPSTAKES', 3, 'captured', 'Captured', 'system.captured_at', 'datetime', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SWEEPSTAKES', 4, 'delivered', 'Delivered', 'assignment.delivered_at', 'datetime', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SWEEPSTAKES', 5, 'order', 'Order', 'order.public_order_id', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SWEEPSTAKES', 6, 'source', 'Source', 'system.landing_page', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SWEEPSTAKES', 7, 'replacement', 'Replacement', 'replacement.status', 'enum', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SWEEPSTAKES', 8, 'followup', 'Follow-up', 'assignment.followup_status', 'enum', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SWEEPSTAKES', 9, 'full_name', 'Full Name', 'lead.full_name', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SWEEPSTAKES', 10, 'address', 'Address', 'lead.address', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SWEEPSTAKES', 11, 'city', 'City', 'qualification.city', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SWEEPSTAKES', 12, 'state', 'State', 'lead.state', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SWEEPSTAKES', 13, 'zip', 'ZIP', 'lead.zip', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SWEEPSTAKES', 14, 'dob', 'Date of Birth', 'qualification.dob', 'date', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SWEEPSTAKES', 15, 'email', 'Email Address', 'lead.email', 'email', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'SWEEPSTAKES', 16, 'phone', 'Phone Number', 'lead.phone', 'phone', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 1, 'lead_id', 'Lead ID', 'system.public_lead_id', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 2, 'status', 'Status', 'assignment.delivery_status', 'enum', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 3, 'captured', 'Captured', 'system.captured_at', 'datetime', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 4, 'delivered', 'Delivered', 'assignment.delivered_at', 'datetime', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 5, 'order', 'Order', 'order.public_order_id', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 6, 'source', 'Source', 'system.landing_page', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 7, 'replacement', 'Replacement', 'replacement.status', 'enum', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 8, 'followup', 'Follow-up', 'assignment.followup_status', 'enum', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 9, 'fname', 'FNAME', 'qualification.fname', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 10, 'lname', 'LNAME', 'qualification.lname', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 11, 'address', 'ADDRESS', 'lead.address', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 12, 'city', 'CITY', 'qualification.city', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 13, 'state', 'STATE', 'lead.state', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 14, 'zip', 'ZIP', 'lead.zip', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 15, 'email', 'EMAIL', 'lead.email', 'email', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 16, 'phone', 'PHONE', 'lead.phone', 'phone', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 17, 'loan_amount', 'LOAN AMOUNT', 'qualification.loan_amount', 'money', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 18, 'employment_status', 'EMPLOYMENT STATUS', 'qualification.employment_status', 'enum', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 19, 'phone_alt', 'PHONE (ALT)', 'qualification.phone_alt', 'phone', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 20, 'occupation', 'OCCUPATION', 'qualification.occupation', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 21, 'current_job', 'CURRENT JOB', 'qualification.current_job', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 22, 'paycheck_type', 'PAYCHECK TYPE', 'qualification.paycheck_type', 'enum', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 23, 'current_checking', 'CURRENT CHECKING', 'qualification.current_checking', 'boolean', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 24, 'has_bank', 'BANK', 'qualification.has_bank', 'boolean', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 25, 'routing_number', 'ROUTING NUMBER', 'qualification.routing_number', 'string', true, 'routing', true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 26, 'account_number', 'ACCOUNT NUMBER', 'qualification.account_number', 'string', true, 'account', true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 27, 'ssn', 'SSN', 'qualification.ssn', 'string', true, 'ssn', true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 28, 'dob', 'DOB', 'qualification.dob', 'date', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 29, 'drivers_st', 'DRIVERS_ST', 'qualification.drivers_st', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 30, 'ref1_phone', 'REF1_PHONE', 'qualification.ref1_phone', 'phone', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 31, 'ref2_phone', 'REF2_PHONE', 'qualification.ref2_phone', 'phone', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 32, 'rent', 'RENT', 'qualification.rent', 'money', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 33, 'bank_years', 'BANK_YEARS', 'qualification.bank_years', 'integer', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'PAYDAY', 34, 'bank_name', 'BANK_NAME', 'qualification.bank_name', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'HOMEOWNER', 1, 'lead_id', 'Lead ID', 'system.public_lead_id', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'HOMEOWNER', 2, 'status', 'Status', 'assignment.delivery_status', 'enum', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'HOMEOWNER', 3, 'captured', 'Captured', 'system.captured_at', 'datetime', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'HOMEOWNER', 4, 'delivered', 'Delivered', 'assignment.delivered_at', 'datetime', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'HOMEOWNER', 5, 'order', 'Order', 'order.public_order_id', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'HOMEOWNER', 6, 'source', 'Source', 'system.landing_page', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'HOMEOWNER', 7, 'replacement', 'Replacement', 'replacement.status', 'enum', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'HOMEOWNER', 8, 'followup', 'Follow-up', 'assignment.followup_status', 'enum', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'HOMEOWNER', 9, 'first_name_01', 'First_Name_01', 'qualification.first_name_01', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'HOMEOWNER', 10, 'last_name_01', 'Last_Name_01', 'qualification.last_name_01', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'HOMEOWNER', 11, 'address', 'Address', 'lead.address', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'HOMEOWNER', 12, 'city', 'City', 'qualification.city', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'HOMEOWNER', 13, 'county_description', 'County_Description', 'qualification.county_description', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'HOMEOWNER', 14, 'state', 'State', 'lead.state', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'HOMEOWNER', 15, 'zip', 'ZIP', 'lead.zip', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'HOMEOWNER', 16, 'email', 'Email', 'lead.email', 'email', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'HOMEOWNER', 17, 'cell_phone', 'CellPhone', 'lead.phone', 'phone', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'HOMEOWNER', 18, 'carrier_route', 'Carrier_Route', 'qualification.carrier_route', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'HOMEOWNER', 19, 'time_zone_code', 'Time_Zone_Code', 'qualification.time_zone_code', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'HOMEOWNER', 20, 'ind_ethnic_code', 'Ind_Ethnic_Code', 'qualification.ind_ethnic_code', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'HOMEOWNER', 21, 'home_value_description', 'Home_Value_Description', 'qualification.home_value_description', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'HOMEOWNER', 22, 'credit_capacity', 'Credit_Capacity', 'qualification.credit_capacity', 'string', false, NULL, true, now(), now()),
  (gen_random_uuid(), 'HOMEOWNER', 23, 'income_description', 'Income_Description', 'qualification.income_description', 'string', false, NULL, true, now(), now())
ON CONFLICT ("lead_type","field_key") DO NOTHING;
