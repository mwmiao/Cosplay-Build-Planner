-- AlterTable
ALTER TABLE "ReferenceImage" ADD COLUMN "stage" TEXT;
ALTER TABLE "ReferenceImage" ADD COLUMN "takenAt" DATETIME;

-- CreateTable
CREATE TABLE "Organiser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "instagram" TEXT,
    "website" TEXT,
    "city" TEXT,
    "usualVenue" TEXT,
    "usualAddress" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'other',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "time" TEXT,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Portugal',
    "venue" TEXT,
    "address" TEXT,
    "mapUrl" TEXT,
    "url" TEXT,
    "tickets" TEXT,
    "notes" TEXT,
    "eventType" TEXT NOT NULL DEFAULT 'other',
    "announceStatus" TEXT NOT NULL DEFAULT 'announced',
    "status" TEXT NOT NULL DEFAULT 'approved',
    "source" TEXT NOT NULL DEFAULT 'admin',
    "sourceUrl" TEXT,
    "capturedAt" DATETIME,
    "posterUrl" TEXT,
    "externalKey" TEXT,
    "builtinHash" TEXT,
    "editedAt" DATETIME,
    "pendingChange" TEXT,
    "organiserId" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "Organiser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("address", "city", "createdAt", "createdBy", "endDate", "externalKey", "id", "mapUrl", "name", "notes", "source", "sourceUrl", "startDate", "status", "updatedAt", "url", "venue") SELECT "address", "city", "createdAt", "createdBy", "endDate", "externalKey", "id", "mapUrl", "name", "notes", "source", "sourceUrl", "startDate", "status", "updatedAt", "url", "venue" FROM "Event";
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
    "includeProgress" BOOLEAN NOT NULL DEFAULT false,
    "coverImageId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "versionAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Publication_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Publication_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Publication" ("coverImageId", "description", "id", "imageMode", "includeBudget", "includeCosts", "includeLinks", "ownerId", "projectId", "publishedAt", "selectedImageIds", "series", "snapshot", "tags", "title", "version", "versionAt") SELECT "coverImageId", "description", "id", "imageMode", "includeBudget", "includeCosts", "includeLinks", "ownerId", "projectId", "publishedAt", "selectedImageIds", "series", "snapshot", "tags", "title", "version", "versionAt" FROM "Publication";
DROP TABLE "Publication";
ALTER TABLE "new_Publication" RENAME TO "Publication";
CREATE UNIQUE INDEX "Publication_projectId_key" ON "Publication"("projectId");
CREATE INDEX "Publication_publishedAt_idx" ON "Publication"("publishedAt");
CREATE INDEX "Publication_versionAt_idx" ON "Publication"("versionAt");
CREATE INDEX "Publication_ownerId_idx" ON "Publication"("ownerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Organiser_instagram_key" ON "Organiser"("instagram");

-- Suggestions waiting for an admin are now called "needs_review".
UPDATE "Event" SET "status" = 'needs_review' WHERE "status" = 'pending';
-- Admin-added events count as edited by an admin (automatic refreshes never overwrite them).
UPDATE "Event" SET "editedAt" = "updatedAt" WHERE "source" = 'admin';
