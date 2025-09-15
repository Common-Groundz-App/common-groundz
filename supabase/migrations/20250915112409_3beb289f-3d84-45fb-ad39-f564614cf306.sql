-- Fix the existing Mickey Mouse entity to have Disney as its parent
UPDATE public.entities 
SET parent_id = '2b6a6aae-374b-4185-92dd-3851edfc9861'
WHERE id = '6ca1e688-5132-4fba-9edb-084d23afdb88';