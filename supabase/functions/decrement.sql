
CREATE OR REPLACE FUNCTION decrement(x integer)
RETURNS integer AS $$
BEGIN
  RETURN x - 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
