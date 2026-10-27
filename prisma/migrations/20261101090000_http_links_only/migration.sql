-- 1.7.2: links read from outside the app (event listings, feeds) must be
-- http(s). Clears any other scheme (e.g. "javascript:", "data:") stored by
-- earlier versions. http(s) links and empty values are left untouched.
UPDATE "Event" SET "url" = NULL WHERE "url" IS NOT NULL AND NOT (ltrim("url") LIKE 'http://%' OR ltrim("url") LIKE 'https://%');
UPDATE "Event" SET "sourceUrl" = NULL WHERE "sourceUrl" IS NOT NULL AND NOT (ltrim("sourceUrl") LIKE 'http://%' OR ltrim("sourceUrl") LIKE 'https://%');
UPDATE "Event" SET "posterUrl" = NULL WHERE "posterUrl" IS NOT NULL AND NOT (ltrim("posterUrl") LIKE 'http://%' OR ltrim("posterUrl") LIKE 'https://%');
UPDATE "Event" SET "mapUrl" = NULL WHERE "mapUrl" IS NOT NULL AND NOT (ltrim("mapUrl") LIKE 'http://%' OR ltrim("mapUrl") LIKE 'https://%');
UPDATE "InstagramPost" SET "permalink" = NULL WHERE "permalink" IS NOT NULL AND NOT (ltrim("permalink") LIKE 'http://%' OR ltrim("permalink") LIKE 'https://%');
UPDATE "InstagramPost" SET "imageUrl" = NULL WHERE "imageUrl" IS NOT NULL AND NOT (ltrim("imageUrl") LIKE 'http://%' OR ltrim("imageUrl") LIKE 'https://%');
