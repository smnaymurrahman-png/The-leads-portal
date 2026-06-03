-- Order processing rework: replace the Stripe invoice flow with an
-- off-platform (WhatsApp) payment-proof flow.
--   * New PaymentMethod enum.
--   * OrderStatus loses REQUESTED/ACCEPTED/INVOICED/PAID/PAYMENT_FAILED and
--     gains AWAITING_PAYMENT/PROOF_SUBMITTED.
--   * Orders carry the uploaded payment screenshot + cancellation metadata.
--   * Transactions/Invoices drop Stripe ids in favour of off-platform fields.

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'MOBILE_WALLET', 'CASH', 'CHECK', 'OTHER');

-- AlterEnum — swap OrderStatus, remapping retired values onto the new flow so
-- existing rows survive the cast (a plain cast would fail on removed values).
BEGIN;
CREATE TYPE "OrderStatus_new" AS ENUM ('DRAFT', 'AWAITING_PAYMENT', 'PROOF_SUBMITTED', 'ACTIVE', 'FULFILLING', 'COMPLETED', 'REJECTED', 'PAUSED', 'CANCELLED');
ALTER TABLE "orders" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "orders" ALTER COLUMN "status" TYPE "OrderStatus_new" USING (
  CASE "status"::text
    WHEN 'REQUESTED'       THEN 'AWAITING_PAYMENT'
    WHEN 'ACCEPTED'        THEN 'AWAITING_PAYMENT'
    WHEN 'INVOICED'        THEN 'AWAITING_PAYMENT'
    WHEN 'PAYMENT_FAILED'  THEN 'AWAITING_PAYMENT'
    WHEN 'PAID'            THEN 'ACTIVE'
    ELSE "status"::text
  END::"OrderStatus_new"
);
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "OrderStatus_old";
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterTable
ALTER TABLE "clients" DROP COLUMN "stripe_customer_id";

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "stripe_invoice_id",
DROP COLUMN "stripe_payment_link",
ADD COLUMN     "cancelled_at" TIMESTAMPTZ(6),
ADD COLUMN     "cancelled_by" UUID,
ADD COLUMN     "cancelled_reason" TEXT,
ADD COLUMN     "payment_method" "PaymentMethod",
ADD COLUMN     "payment_note" TEXT,
ADD COLUMN     "payment_reference" TEXT,
ADD COLUMN     "payment_screenshot_filename" TEXT,
ADD COLUMN     "payment_screenshot_mime" TEXT,
ADD COLUMN     "payment_screenshot_path" TEXT,
ADD COLUMN     "payment_screenshot_sha256" TEXT,
ADD COLUMN     "payment_screenshot_size" INTEGER,
ADD COLUMN     "payment_uploaded_at" TIMESTAMPTZ(6),
ADD COLUMN     "payment_uploaded_by" UUID;

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "stripe_payment_id",
ADD COLUMN     "payment_method" "PaymentMethod",
ADD COLUMN     "payment_reference" TEXT,
ADD COLUMN     "recorded_by" UUID;

-- AlterTable
ALTER TABLE "invoices" DROP COLUMN "pdf_url",
ADD COLUMN     "issued_by" UUID,
ADD COLUMN     "pdf_path" TEXT;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_uploaded_by_fkey" FOREIGN KEY ("payment_uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
