-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "city" TEXT NOT NULL,
    "venue" TEXT,
    "address" TEXT,
    "mapUrl" TEXT,
    "url" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "source" TEXT NOT NULL DEFAULT 'admin',
    "sourceUrl" TEXT,
    "externalKey" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Event" ("city", "createdAt", "createdBy", "endDate", "id", "name", "notes", "startDate", "updatedAt", "url", "venue") SELECT "city", "createdAt", "createdBy", "endDate", "id", "name", "notes", "startDate", "updatedAt", "url", "venue" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_externalKey_key" ON "Event"("externalKey");
CREATE INDEX "Event_status_startDate_idx" ON "Event"("status", "startDate");
CREATE TABLE "new_Publication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "series" TEXT,
    "description" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "includeBudget" BOOLEAN NOT NULL DEFAULT false,
    "includeCosts" BOOLEAN NOT NULL DEFAULT false,
    "includeLinks" BOOLEAN NOT NULL DEFAULT false,
    "snapshot" TEXT NOT NULL,
    "imageMode" TEXT NOT NULL DEFAULT 'all',
    "selectedImageIds" TEXT NOT NULL DEFAULT '[]',
    "coverImageId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "versionAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Publication_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Publication_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Publication" ("coverImageId", "description", "id", "includeBudget", "includeCosts", "includeLinks", "ownerId", "projectId", "publishedAt", "series", "snapshot", "tags", "title", "version", "versionAt") SELECT "coverImageId", "description", "id", "includeBudget", "includeCosts", "includeLinks", "ownerId", "projectId", "publishedAt", "series", "snapshot", "tags", "title", "version", "versionAt" FROM "Publication";
DROP TABLE "Publication";
ALTER TABLE "new_Publication" RENAME TO "Publication";
CREATE UNIQUE INDEX "Publication_projectId_key" ON "Publication"("projectId");
CREATE INDEX "Publication_publishedAt_idx" ON "Publication"("publishedAt");
CREATE INDEX "Publication_versionAt_idx" ON "Publication"("versionAt");
CREATE INDEX "Publication_ownerId_idx" ON "Publication"("ownerId");
CREATE TABLE "new_ReferenceImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'reference',
    "partId" TEXT,
    "groupName" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "filePath" TEXT NOT NULL,
    "thumbPath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "width" INTEGER,
    "height" INTEGER,
    "caption" TEXT,
    "sourceUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferenceImage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReferenceImage_partId_fkey" FOREIGN KEY ("partId") REFERENCES "BuildPart" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ReferenceImage" ("caption", "createdAt", "filePath", "groupName", "height", "id", "kind", "mimeType", "originalName", "partId", "position", "projectId", "sizeBytes", "sourceUrl", "thumbPath", "width") SELECT "caption", "createdAt", "filePath", "groupName", "height", "id", "kind", "mimeType", "originalName", "partId", "position", "projectId", "sizeBytes", "sourceUrl", "thumbPath", "width" FROM "ReferenceImage";
DROP TABLE "ReferenceImage";
ALTER TABLE "new_ReferenceImage" RENAME TO "ReferenceImage";
CREATE INDEX "ReferenceImage_projectId_kind_position_idx" ON "ReferenceImage"("projectId", "kind", "position");
CREATE INDEX "ReferenceImage_partId_idx" ON "ReferenceImage"("partId");
CREATE TABLE "new_user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "defaultCurrency" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_user" ("createdAt", "defaultCurrency", "email", "emailVerified", "id", "image", "name", "role", "updatedAt") SELECT "createdAt", "defaultCurrency", "email", "emailVerified", "id", "image", "name", "role", "updatedAt" FROM "user";
DROP TABLE "user";
ALTER TABLE "new_user" RENAME TO "user";
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Publications made before live pages keep exactly the images their owner
-- chose then (no new image becomes public without the owner switching to
-- "main picture + all reference images").
UPDATE "Publication" SET
    "imageMode" = 'selected',
    "selectedImageIds" = COALESCE((
        SELECT json_group_array("sourceImageId") FROM (
            SELECT pi."sourceImageId" FROM "PublicImage" AS pi
            WHERE pi."publicationId" = "Publication"."id" AND pi."sourceImageId" IS NOT NULL
            ORDER BY pi."position"
        )
    ), '[]');
