-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "defaultCurrency" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expiresAt" DATETIME NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuthRateLimit" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL,
    "windowStart" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT,
    "characterName" TEXT NOT NULL,
    "series" TEXT,
    "conventionName" TEXT,
    "deadline" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'idea',
    "currency" TEXT,
    "budgetCents" INTEGER,
    "spentCents" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "archivedAt" DATETIME,
    "deletedAt" DATETIME,
    CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("archivedAt", "budgetCents", "characterName", "conventionName", "createdAt", "currency", "deadline", "deletedAt", "id", "notes", "series", "spentCents", "status", "updatedAt") SELECT "archivedAt", "budgetCents", "characterName", "conventionName", "createdAt", "currency", "deadline", "deletedAt", "id", "notes", "series", "spentCents", "status", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_ownerId_deletedAt_archivedAt_idx" ON "Project"("ownerId", "deletedAt", "archivedAt");
CREATE INDEX "Project_deletedAt_archivedAt_idx" ON "Project"("deletedAt", "archivedAt");
CREATE TABLE "new_ShoppingListItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT,
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
    CONSTRAINT "ShoppingListItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShoppingListItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShoppingListItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES "BuildPart" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ShoppingListItem" ("category", "createdAt", "currency", "deletedAt", "estimatedCostCents", "id", "name", "notes", "partId", "projectId", "purchased", "purchasedAt", "quantity", "supplier", "uid", "updatedAt", "url") SELECT "category", "createdAt", "currency", "deletedAt", "estimatedCostCents", "id", "name", "notes", "partId", "projectId", "purchased", "purchasedAt", "quantity", "supplier", "uid", "updatedAt", "url" FROM "ShoppingListItem";
DROP TABLE "ShoppingListItem";
ALTER TABLE "new_ShoppingListItem" RENAME TO "ShoppingListItem";
CREATE UNIQUE INDEX "ShoppingListItem_partId_key" ON "ShoppingListItem"("partId");
CREATE INDEX "ShoppingListItem_ownerId_deletedAt_idx" ON "ShoppingListItem"("ownerId", "deletedAt");
CREATE INDEX "ShoppingListItem_deletedAt_purchased_idx" ON "ShoppingListItem"("deletedAt", "purchased");
CREATE UNIQUE INDEX "ShoppingListItem_projectId_uid_key" ON "ShoppingListItem"("projectId", "uid");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

