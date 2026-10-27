-- AlterTable
ALTER TABLE "Event" ADD COLUMN "confidence" INTEGER;
ALTER TABLE "Event" ADD COLUMN "confidenceNote" TEXT;

-- CreateTable
CREATE TABLE "InstagramSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'organiser',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "feedUrl" TEXT,
    "providerName" TEXT NOT NULL DEFAULT 'rss-bridge',
    "organiserId" TEXT,
    "lastCheckedAt" DATETIME,
    "lastSuccessfulCheckAt" DATETIME,
    "lastError" TEXT,
    "latestSeenPostId" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "nextCheckAt" DATETIME,
    "lockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InstagramSource_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "Organiser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstagramPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT,
    "externalId" TEXT,
    "permalink" TEXT,
    "title" TEXT,
    "caption" TEXT,
    "publishedAt" DATETIME,
    "imageUrl" TEXT,
    "raw" TEXT,
    "provider" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending_review',
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT,
    "extracted" TEXT,
    "eventId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InstagramPost_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "InstagramSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InstagramPost_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventUpdate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "changes" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventUpdate_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventUpdate_postId_fkey" FOREIGN KEY ("postId") REFERENCES "InstagramPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "postId" TEXT,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminNotification_postId_fkey" FOREIGN KEY ("postId") REFERENCES "InstagramPost" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "InstagramSource_username_key" ON "InstagramSource"("username");

-- CreateIndex
CREATE INDEX "InstagramPost_permalink_idx" ON "InstagramPost"("permalink");

-- CreateIndex
CREATE INDEX "InstagramPost_reviewStatus_createdAt_idx" ON "InstagramPost"("reviewStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "InstagramPost_sourceId_externalId_key" ON "InstagramPost"("sourceId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "EventUpdate_postId_key" ON "EventUpdate"("postId");

-- CreateIndex
CREATE INDEX "EventUpdate_status_idx" ON "EventUpdate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AdminNotification_postId_key" ON "AdminNotification"("postId");

-- CreateIndex
CREATE INDEX "AdminNotification_readAt_createdAt_idx" ON "AdminNotification"("readAt", "createdAt");

-- Events waiting for an admin are now "pending_review" (was "needs_review").
UPDATE "Event" SET "status" = 'pending_review' WHERE "status" = 'needs_review';

-- Instagram usernames saved on organisers (1.7.0, Graph API) become monitored
-- sources, linked back to their organiser. The organiser column is kept.
INSERT INTO "InstagramSource" ("id", "username", "displayName", "sourceType", "active", "providerName", "organiserId", "createdAt", "updatedAt")
SELECT 'c' || lower(hex(randomblob(12))), lower("instagram"), "name", 'organiser', "active", 'rss-bridge', "id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Organiser"
WHERE "instagram" IS NOT NULL AND "instagram" <> '';
