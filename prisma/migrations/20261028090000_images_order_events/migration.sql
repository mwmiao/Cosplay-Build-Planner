-- AlterTable
ALTER TABLE "Project" ADD COLUMN "startDate" DATETIME;

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "city" TEXT NOT NULL,
    "venue" TEXT,
    "url" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BuildPart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uid" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "status" TEXT NOT NULL DEFAULT 'needed',
    "currency" TEXT,
    "estimatedCostCents" INTEGER,
    "actualCostCents" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "supplier" TEXT,
    "url" TEXT,
    "notes" TEXT,
    "completedAt" DATETIME,
    "position" INTEGER NOT NULL DEFAULT 0,
    "paidAt" DATETIME,
    "paidBaseCents" INTEGER,
    "fxRate" REAL,
    "fxRateDate" TEXT,
    "fxSource" TEXT,
    "fxManual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "BuildPart_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BuildPart" ("actualCostCents", "category", "completedAt", "createdAt", "currency", "deletedAt", "estimatedCostCents", "fxManual", "fxRate", "fxRateDate", "fxSource", "id", "name", "notes", "paidAt", "paidBaseCents", "projectId", "quantity", "status", "supplier", "uid", "updatedAt", "url") SELECT "actualCostCents", "category", "completedAt", "createdAt", "currency", "deletedAt", "estimatedCostCents", "fxManual", "fxRate", "fxRateDate", "fxSource", "id", "name", "notes", "paidAt", "paidBaseCents", "projectId", "quantity", "status", "supplier", "uid", "updatedAt", "url" FROM "BuildPart";
DROP TABLE "BuildPart";
ALTER TABLE "new_BuildPart" RENAME TO "BuildPart";
CREATE INDEX "BuildPart_projectId_deletedAt_idx" ON "BuildPart"("projectId", "deletedAt");
CREATE UNIQUE INDEX "BuildPart_projectId_uid_key" ON "BuildPart"("projectId", "uid");
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
    "width" INTEGER,
    "height" INTEGER,
    "caption" TEXT,
    "sourceUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferenceImage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReferenceImage_partId_fkey" FOREIGN KEY ("partId") REFERENCES "BuildPart" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ReferenceImage" ("caption", "createdAt", "filePath", "height", "id", "mimeType", "originalName", "projectId", "sizeBytes", "sourceUrl", "thumbPath", "width") SELECT "caption", "createdAt", "filePath", "height", "id", "mimeType", "originalName", "projectId", "sizeBytes", "sourceUrl", "thumbPath", "width" FROM "ReferenceImage";
DROP TABLE "ReferenceImage";
ALTER TABLE "new_ReferenceImage" RENAME TO "ReferenceImage";
CREATE INDEX "ReferenceImage_projectId_kind_position_idx" ON "ReferenceImage"("projectId", "kind", "position");
CREATE INDEX "ReferenceImage_partId_idx" ON "ReferenceImage"("partId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Event_startDate_idx" ON "Event"("startDate");

-- Backfill manual order so nothing visibly moves: parts in the order they were
-- added (as before), reference images newest first (as before).
UPDATE "BuildPart" SET "position" = (
    SELECT COUNT(*) FROM "BuildPart" AS b2
    WHERE b2."projectId" = "BuildPart"."projectId"
      AND (b2."createdAt" < "BuildPart"."createdAt"
           OR (b2."createdAt" = "BuildPart"."createdAt" AND b2."id" < "BuildPart"."id"))
);
UPDATE "ReferenceImage" SET "position" = (
    SELECT COUNT(*) FROM "ReferenceImage" AS r2
    WHERE r2."projectId" = "ReferenceImage"."projectId"
      AND (r2."createdAt" > "ReferenceImage"."createdAt"
           OR (r2."createdAt" = "ReferenceImage"."createdAt" AND r2."id" > "ReferenceImage"."id"))
);
