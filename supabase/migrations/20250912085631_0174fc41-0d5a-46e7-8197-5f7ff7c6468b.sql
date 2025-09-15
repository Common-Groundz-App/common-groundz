-- Clean up duplicate "superyou" brands, keeping the first one created
DELETE FROM entities 
WHERE id = '8cd6b1c8-6499-4c70-9892-fd18c468c099' 
AND type = 'brand' 
AND name = 'superyou';