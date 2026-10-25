-- AlterTable
ALTER TABLE "Project" ADD COLUMN "currency" TEXT;

-- AlterTable
ALTER TABLE "ShoppingListItem" ADD COLUMN "currency" TEXT;

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "currency" TEXT NOT NULL PRIMARY KEY,
    "ratePerEur" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "rateDate" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BuildPart" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
INSERT INTO "new_BuildPart" ("actualCostCents", "category", "completedAt", "createdAt", "deletedAt", "estimatedCostCents", "id", "name", "notes", "projectId", "quantity", "status", "supplier", "updatedAt", "url") SELECT "actualCostCents", "category", "completedAt", "createdAt", "deletedAt", "estimatedCostCents", "id", "name", "notes", "projectId", "quantity", "status", "supplier", "updatedAt", "url" FROM "BuildPart";
DROP TABLE "BuildPart";
ALTER TABLE "new_BuildPart" RENAME TO "BuildPart";
CREATE INDEX "BuildPart_projectId_deletedAt_idx" ON "BuildPart"("projectId", "deletedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- Parts that already had an actual cost were entered before currencies existed:
-- treat them as paid in the project's base currency (rate 1) on their last edit date.
UPDATE "BuildPart"
SET "paidAt" = ("updatedAt" / 86400000) * 86400000,
    "paidBaseCents" = "actualCostCents" * "quantity",
    "fxRate" = 1.0,
    "fxRateDate" = date("updatedAt" / 1000, 'unixepoch'),
    "fxSource" = 'Entered before multi-currency (base currency)',
    "fxManual" = false
WHERE "actualCostCents" IS NOT NULL AND "deletedAt" IS NULL;
