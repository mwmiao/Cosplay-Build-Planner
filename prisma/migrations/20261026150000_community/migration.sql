-- CreateTable
CREATE TABLE "Publication" (
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
    "coverImageId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "versionAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Publication_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Publication_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PublicImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicationId" TEXT NOT NULL,
    "sourceImageId" TEXT,
    "filePath" TEXT NOT NULL,
    "thumbPath" TEXT NOT NULL,
    "caption" TEXT,
    "position" INTEGER NOT NULL,
    CONSTRAINT "PublicImage_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Publication_projectId_key" ON "Publication"("projectId");

-- CreateIndex
CREATE INDEX "Publication_publishedAt_idx" ON "Publication"("publishedAt");

-- CreateIndex
CREATE INDEX "Publication_versionAt_idx" ON "Publication"("versionAt");

-- CreateIndex
CREATE INDEX "Publication_ownerId_idx" ON "Publication"("ownerId");

-- CreateIndex
CREATE INDEX "PublicImage_publicationId_idx" ON "PublicImage"("publicationId");

