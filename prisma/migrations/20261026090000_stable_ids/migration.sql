-- Existing rows get a stable uid equal to their current id.
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
INSERT INTO "new_BuildPart" ("actualCostCents", "category", "completedAt", "createdAt", "currency", "deletedAt", "estimatedCostCents", "fxManual", "fxRate", "fxRateDate", "fxSource", "id", "name", "notes", "paidAt", "paidBaseCents", "projectId", "quantity", "status", "supplier", "updatedAt", "url", "uid") SELECT "actualCostCents", "category", "completedAt", "createdAt", "currency", "deletedAt", "estimatedCostCents", "fxManual", "fxRate", "fxRateDate", "fxSource", "id", "name", "notes", "paidAt", "paidBaseCents", "projectId", "quantity", "status", "supplier", "updatedAt", "url", "id" FROM "BuildPart";
DROP TABLE "BuildPart";
ALTER TABLE "new_BuildPart" RENAME TO "BuildPart";
CREATE INDEX "BuildPart_projectId_deletedAt_idx" ON "BuildPart"("projectId", "deletedAt");
CREATE UNIQUE INDEX "BuildPart_projectId_uid_key" ON "BuildPart"("projectId", "uid");
CREATE TABLE "new_ShoppingListItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uid" TEXT NOT NULL,
    "projectId" TEXT,
    "partId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "supplier" TEXT,
    "url" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT,
    "estimatedCostCents" INTEGER,
    "notes" TEXT,
    "purchased" BOOLEAN NOT NULL DEFAULT false,
    "purchasedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "ShoppingListItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShoppingListItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES "BuildPart" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ShoppingListItem" ("category", "createdAt", "currency", "deletedAt", "estimatedCostCents", "id", "name", "notes", "partId", "projectId", "purchased", "purchasedAt", "quantity", "supplier", "updatedAt", "url", "uid") SELECT "category", "createdAt", "currency", "deletedAt", "estimatedCostCents", "id", "name", "notes", "partId", "projectId", "purchased", "purchasedAt", "quantity", "supplier", "updatedAt", "url", "id" FROM "ShoppingListItem";
DROP TABLE "ShoppingListItem";
ALTER TABLE "new_ShoppingListItem" RENAME TO "ShoppingListItem";
CREATE UNIQUE INDEX "ShoppingListItem_partId_key" ON "ShoppingListItem"("partId");
CREATE INDEX "ShoppingListItem_deletedAt_purchased_idx" ON "ShoppingListItem"("deletedAt", "purchased");
CREATE UNIQUE INDEX "ShoppingListItem_projectId_uid_key" ON "ShoppingListItem"("projectId", "uid");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

