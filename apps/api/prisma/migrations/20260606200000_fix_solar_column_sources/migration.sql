-- Point the Solar sheet columns at the real WordPress (JetFormBuilder) field
-- keys the Solar form actually submits, so the cells render data instead of "—".
-- Only updates rows still on the original (guessed) source, so it won't clobber
-- any source an admin has since edited.

UPDATE "lead_type_columns" SET "source" = 'qualification.is_this_residential_or_commercial', "updated_at" = now()
  WHERE "lead_type" = 'SOLAR' AND "field_key" = 'property_type' AND "source" = 'qualification.property_type';

UPDATE "lead_type_columns" SET "source" = 'qualification.utility_bill_of_client', "updated_at" = now()
  WHERE "lead_type" = 'SOLAR' AND "field_key" = 'monthly_bill' AND "source" = 'qualification.monthly_bill';

UPDATE "lead_type_columns" SET "source" = 'qualification.describeyourrooftype', "updated_at" = now()
  WHERE "lead_type" = 'SOLAR' AND "field_key" = 'roof_type' AND "source" = 'qualification.roof_type';

UPDATE "lead_type_columns" SET "source" = 'qualification.doyouownthishome', "updated_at" = now()
  WHERE "lead_type" = 'SOLAR' AND "field_key" = 'own_home' AND "source" = 'qualification.own_home';

UPDATE "lead_type_columns" SET "source" = 'qualification.how_old_is_your_home', "updated_at" = now()
  WHERE "lead_type" = 'SOLAR' AND "field_key" = 'home_age' AND "source" = 'qualification.how_old_is_your_home';
