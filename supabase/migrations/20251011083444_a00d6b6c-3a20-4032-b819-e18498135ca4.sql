-- Create materialized view for entity statistics (user-agnostic metrics only)
CREATE MATERIALIZED VIEW entity_stats_view AS
WITH recommendation_stats AS (
  SELECT 
    entity_id,
    COUNT(*) as recommendation_count,
    SUM(rating) as sum_recommendation_rating
  FROM recommendations
  WHERE visibility = 'public'
  GROUP BY entity_id
),
review_stats AS (
  SELECT 
    entity_id,
    COUNT(*) as review_count,
    SUM(COALESCE(latest_rating, rating)) as sum_review_rating
  FROM reviews
  WHERE visibility = 'public' AND status = 'published'
  GROUP BY entity_id
)
SELECT
  e.id as entity_id,
  COALESCE(rs.recommendation_count, 0)::INTEGER as recommendation_count,
  COALESCE(rvs.review_count, 0)::INTEGER as review_count,
  CASE
    WHEN COALESCE(rs.recommendation_count, 0) + COALESCE(rvs.review_count, 0) = 0 THEN NULL
    ELSE ROUND(
      (COALESCE(rs.sum_recommendation_rating, 0) + COALESCE(rvs.sum_review_rating, 0))::NUMERIC /
      (COALESCE(rs.recommendation_count, 0) + COALESCE(rvs.review_count, 0))::NUMERIC,
      1
    )::NUMERIC(3,1)
  END as average_rating
FROM entities e
LEFT JOIN recommendation_stats rs ON e.id = rs.entity_id
LEFT JOIN review_stats rvs ON e.id = rvs.entity_id
WHERE e.is_deleted = false;

-- Create indexes for fast lookups
CREATE UNIQUE INDEX idx_entity_stats_view_entity_id ON entity_stats_view(entity_id);
CREATE INDEX idx_entity_stats_view_avg_rating ON entity_stats_view(average_rating DESC NULLS LAST);

-- Grant permissions
GRANT SELECT ON entity_stats_view TO authenticated;
GRANT SELECT ON entity_stats_view TO anon;

-- Schedule hourly refresh using pg_cron
SELECT cron.schedule(
  'refresh-entity-stats-view-hourly',
  '0 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY entity_stats_view$$
);