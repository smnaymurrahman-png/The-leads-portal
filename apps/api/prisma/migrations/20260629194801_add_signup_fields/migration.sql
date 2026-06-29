-- AlterEnum
ALTER TYPE "AccountStatus" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "targeted_lead_type" "LeadType";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "business_name" TEXT;
