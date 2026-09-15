DROP INDEX public.idx_entities_trending_score;
DROP INDEX public.idx_entities_trending_popularity;
ALTER TABLE public.entities DROP COLUMN trending_score;