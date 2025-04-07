
-- Create a secure function to execute SQL queries
-- This is used to work around TypeScript database type issues
CREATE OR REPLACE FUNCTION execute_sql(
  query_text TEXT,
  query_params JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  query TEXT;
  param_values TEXT[] := '{}';
  i INTEGER;
BEGIN
  -- Extract parameters from the JSON array
  IF jsonb_array_length(query_params) > 0 THEN
    FOR i IN 0..jsonb_array_length(query_params)-1 LOOP
      param_values := param_values || jsonb_extract_path_text(query_params, i::text)::TEXT;
    END LOOP;
  END IF;

  -- Create the query with the parameters
  query := format(
    'WITH query_result AS (%s) SELECT jsonb_agg(row_to_json(query_result)) FROM query_result',
    query_text
  );

  -- Execute the query with parameters and get the result as JSONB
  EXECUTE query INTO result USING VARIADIC param_values;

  -- Return empty array if null
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Grant execute permission to the function
GRANT EXECUTE ON FUNCTION execute_sql TO authenticated;
GRANT EXECUTE ON FUNCTION execute_sql TO anon;
