/**
 * Column schema seed for the Leads sheet.
 *
 * One row per visible column per LeadType. The web `LeadsSheet` calls
 * `GET /api/lead-type-columns?lead_type=…` and renders headers + binds cells
 * from the result. Re-run the seed any time to refresh after a schema change.
 *
 * Columns are positioned in display order (left → right). Positions 1–8 are
 * the **system** columns shared across every vertical; positions 9+ are the
 * vertical-specific **form** columns sourced from `Lead.qualification`.
 *
 *   source forms:
 *     lead.<col>            → Lead.<full_name|email|phone|address|state|zip|country>
 *     qualification.<key>   → Lead.qualification[<key>]
 *     system.<key>          → public_lead_id | captured_at | lead_state | landing_page
 *     assignment.<key>      → delivery_status | delivered_at | followup_status
 *     order.public_order_id
 *     replacement.status
 */
import { LeadType, type PrismaClient } from '@prisma/client';

export interface ColumnSpec {
  field_key: string;
  label: string;
  source: string;
  data_type?: string;
  sensitive?: boolean;
  /** ssn | account | routing | dl | last4 | full */
  mask_kind?: string;
  default_visible?: boolean;
}

/** The 8 system columns that head every vertical sheet. */
const SYSTEM_COLUMNS: ColumnSpec[] = [
  { field_key: 'lead_id',       label: 'Lead ID',       source: 'system.public_lead_id', data_type: 'string'   },
  { field_key: 'status',        label: 'Status',        source: 'assignment.delivery_status', data_type: 'enum' },
  { field_key: 'captured',      label: 'Captured',      source: 'system.captured_at',    data_type: 'datetime' },
  { field_key: 'delivered',     label: 'Delivered',     source: 'assignment.delivered_at', data_type: 'datetime' },
  { field_key: 'order',         label: 'Order',         source: 'order.public_order_id', data_type: 'string'   },
  { field_key: 'source',        label: 'Source',        source: 'system.landing_page',   data_type: 'string'   },
  { field_key: 'replacement',   label: 'Replacement',   source: 'replacement.status',    data_type: 'enum'     },
  { field_key: 'followup',      label: 'Follow-up',     source: 'assignment.followup_status', data_type: 'enum' },
];

/** Solar — 11 form columns (from the user's spec). */
const SOLAR_COLUMNS: ColumnSpec[] = [
  { field_key: 'home_address',      label: 'Home Address',           source: 'lead.address' },
  { field_key: 'property_type',     label: 'Residential/Commercial', source: 'qualification.property_type', data_type: 'enum' },
  { field_key: 'monthly_bill',      label: 'Utility Bill',           source: 'qualification.monthly_bill', data_type: 'money' },
  { field_key: 'roof_type',         label: 'Roof Type',              source: 'qualification.roof_type', data_type: 'enum' },
  { field_key: 'credit_score',      label: 'Credit Score',           source: 'qualification.credit_score', data_type: 'string' },
  { field_key: 'own_home',          label: 'Own Home?',              source: 'qualification.own_home', data_type: 'enum' },
  { field_key: 'home_age',          label: 'Home Age',               source: 'qualification.home_age', data_type: 'string' },
  { field_key: 'full_name',         label: 'Full Name',              source: 'lead.full_name' },
  { field_key: 'email',             label: 'Email Address',          source: 'lead.email', data_type: 'email' },
  { field_key: 'phone',             label: 'Phone Number',           source: 'lead.phone', data_type: 'phone' },
  { field_key: 'zip',               label: 'ZIP',                    source: 'lead.zip' },
];

/** Sweepstakes — 8 form columns. */
const SWEEPSTAKES_COLUMNS: ColumnSpec[] = [
  { field_key: 'full_name', label: 'Full Name', source: 'lead.full_name' },
  { field_key: 'address',   label: 'Address',   source: 'lead.address' },
  { field_key: 'city',      label: 'City',      source: 'qualification.city' },
  { field_key: 'state',     label: 'State',     source: 'lead.state' },
  { field_key: 'zip',       label: 'ZIP',       source: 'lead.zip' },
  { field_key: 'dob',       label: 'Date of Birth', source: 'qualification.dob', data_type: 'date' },
  { field_key: 'email',     label: 'Email Address', source: 'lead.email', data_type: 'email' },
  { field_key: 'phone',     label: 'Phone Number',  source: 'lead.phone', data_type: 'phone' },
];

/** Payday — 26 form columns. SSN/routing/account are sensitive + encrypted. */
const PAYDAY_COLUMNS: ColumnSpec[] = [
  { field_key: 'fname',             label: 'FNAME',             source: 'qualification.fname' },
  { field_key: 'lname',             label: 'LNAME',             source: 'qualification.lname' },
  { field_key: 'address',           label: 'ADDRESS',           source: 'lead.address' },
  { field_key: 'city',              label: 'CITY',              source: 'qualification.city' },
  { field_key: 'state',             label: 'STATE',             source: 'lead.state' },
  { field_key: 'zip',               label: 'ZIP',               source: 'lead.zip' },
  { field_key: 'email',             label: 'EMAIL',             source: 'lead.email', data_type: 'email' },
  { field_key: 'phone',             label: 'PHONE',             source: 'lead.phone', data_type: 'phone' },
  { field_key: 'loan_amount',       label: 'LOAN AMOUNT',       source: 'qualification.loan_amount', data_type: 'money' },
  { field_key: 'employment_status', label: 'EMPLOYMENT STATUS', source: 'qualification.employment_status', data_type: 'enum' },
  { field_key: 'phone_alt',         label: 'PHONE (ALT)',       source: 'qualification.phone_alt', data_type: 'phone' },
  { field_key: 'occupation',        label: 'OCCUPATION',        source: 'qualification.occupation' },
  { field_key: 'current_job',       label: 'CURRENT JOB',       source: 'qualification.current_job' },
  { field_key: 'paycheck_type',     label: 'PAYCHECK TYPE',     source: 'qualification.paycheck_type', data_type: 'enum' },
  { field_key: 'current_checking',  label: 'CURRENT CHECKING',  source: 'qualification.current_checking', data_type: 'boolean' },
  { field_key: 'has_bank',          label: 'BANK',              source: 'qualification.has_bank', data_type: 'boolean' },
  { field_key: 'routing_number',    label: 'ROUTING NUMBER',    source: 'qualification.routing_number', sensitive: true, mask_kind: 'routing' },
  { field_key: 'account_number',    label: 'ACCOUNT NUMBER',    source: 'qualification.account_number', sensitive: true, mask_kind: 'account' },
  { field_key: 'ssn',               label: 'SSN',               source: 'qualification.ssn',            sensitive: true, mask_kind: 'ssn' },
  { field_key: 'dob',               label: 'DOB',               source: 'qualification.dob', data_type: 'date' },
  { field_key: 'drivers_st',        label: 'DRIVERS_ST',        source: 'qualification.drivers_st' },
  { field_key: 'ref1_phone',        label: 'REF1_PHONE',        source: 'qualification.ref1_phone', data_type: 'phone' },
  { field_key: 'ref2_phone',        label: 'REF2_PHONE',        source: 'qualification.ref2_phone', data_type: 'phone' },
  { field_key: 'rent',              label: 'RENT',              source: 'qualification.rent', data_type: 'money' },
  { field_key: 'bank_years',        label: 'BANK_YEARS',        source: 'qualification.bank_years', data_type: 'integer' },
  { field_key: 'bank_name',         label: 'BANK_NAME',         source: 'qualification.bank_name' },
];

/** Homeowner — 15 form columns (data-broker append style). */
const HOMEOWNER_COLUMNS: ColumnSpec[] = [
  { field_key: 'first_name_01',           label: 'First_Name_01',           source: 'qualification.first_name_01' },
  { field_key: 'last_name_01',            label: 'Last_Name_01',            source: 'qualification.last_name_01' },
  { field_key: 'address',                 label: 'Address',                 source: 'lead.address' },
  { field_key: 'city',                    label: 'City',                    source: 'qualification.city' },
  { field_key: 'county_description',      label: 'County_Description',      source: 'qualification.county_description' },
  { field_key: 'state',                   label: 'State',                   source: 'lead.state' },
  { field_key: 'zip',                     label: 'ZIP',                     source: 'lead.zip' },
  { field_key: 'email',                   label: 'Email',                   source: 'lead.email', data_type: 'email' },
  { field_key: 'cell_phone',              label: 'CellPhone',               source: 'lead.phone', data_type: 'phone' },
  { field_key: 'carrier_route',           label: 'Carrier_Route',           source: 'qualification.carrier_route' },
  { field_key: 'time_zone_code',          label: 'Time_Zone_Code',          source: 'qualification.time_zone_code' },
  { field_key: 'ind_ethnic_code',         label: 'Ind_Ethnic_Code',         source: 'qualification.ind_ethnic_code' },
  { field_key: 'home_value_description',  label: 'Home_Value_Description',  source: 'qualification.home_value_description' },
  { field_key: 'credit_capacity',         label: 'Credit_Capacity',         source: 'qualification.credit_capacity' },
  { field_key: 'income_description',      label: 'Income_Description',      source: 'qualification.income_description' },
];

/** Per-LeadType column list (system + form, in display order). */
export const LEAD_TYPE_COLUMN_DEFS: Record<LeadType, ColumnSpec[]> = {
  SOLAR:       [...SYSTEM_COLUMNS, ...SOLAR_COLUMNS],
  SWEEPSTAKES: [...SYSTEM_COLUMNS, ...SWEEPSTAKES_COLUMNS],
  PAYDAY:      [...SYSTEM_COLUMNS, ...PAYDAY_COLUMNS],
  HOMEOWNER:   [...SYSTEM_COLUMNS, ...HOMEOWNER_COLUMNS],
};

/**
 * Idempotent seed — re-running it converges the DB to the declarations above.
 * Any rows in `lead_type_columns` whose `field_key` is no longer in the spec
 * are deleted (so a removed column disappears from the sheet).
 */
export async function seedLeadTypeColumns(prisma: PrismaClient): Promise<void> {
  for (const [leadTypeStr, columns] of Object.entries(LEAD_TYPE_COLUMN_DEFS)) {
    const leadType = leadTypeStr as LeadType;
    const wantedKeys = new Set(columns.map((c) => c.field_key));

    for (let i = 0; i < columns.length; i++) {
      const c = columns[i];
      const position = i + 1;
      await prisma.leadTypeColumn.upsert({
        where: { lead_type_field_key: { lead_type: leadType, field_key: c.field_key } },
        create: {
          lead_type:       leadType,
          position,
          field_key:       c.field_key,
          label:           c.label,
          source:          c.source,
          data_type:       c.data_type ?? 'string',
          sensitive:       c.sensitive ?? false,
          mask_kind:       c.mask_kind ?? null,
          default_visible: c.default_visible ?? true,
        },
        update: {
          position,
          label:           c.label,
          source:          c.source,
          data_type:       c.data_type ?? 'string',
          sensitive:       c.sensitive ?? false,
          mask_kind:       c.mask_kind ?? null,
          default_visible: c.default_visible ?? true,
        },
      });
    }

    // Drop any columns no longer in the spec — keeps the sheet in sync with
    // declared truth.
    await prisma.leadTypeColumn.deleteMany({
      where: { lead_type: leadType, field_key: { notIn: [...wantedKeys] } },
    });
  }
}
