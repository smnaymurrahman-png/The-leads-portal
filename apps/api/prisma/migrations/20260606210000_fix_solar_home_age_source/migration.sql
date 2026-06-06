-- The previous migration's home_age UPDATE had its WHERE clause checking the
-- new source value (a typo), so it never matched and the column stayed on the
-- guessed key. Point it at the real WordPress form key now.

UPDATE "lead_type_columns" SET "source" = 'qualification.how_old_is_your_home', "updated_at" = now()
  WHERE "lead_type" = 'SOLAR' AND "field_key" = 'home_age' AND "source" = 'qualification.home_age';
