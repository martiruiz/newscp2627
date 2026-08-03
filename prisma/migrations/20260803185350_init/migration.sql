-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Platform" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Sport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "EntityType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ContentFormat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Classification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platformId" TEXT NOT NULL,
    "externalPostId" TEXT NOT NULL,
    "originalUrl" TEXT,
    "canonicalUrl" TEXT NOT NULL,
    "embedUrl" TEXT NOT NULL,
    "instagramPostType" TEXT,
    "accountUsername" TEXT,
    "rawTitle" TEXT,
    "publishedAt" DATETIME,
    "contentFormatId" TEXT,
    "sportId" TEXT,
    "entityTypeId" TEXT,
    "entityName" TEXT,
    "importBatchId" TEXT,
    "rawImportData" TEXT,
    "importStatus" TEXT,
    "importError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Publication_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Publication_contentFormatId_fkey" FOREIGN KEY ("contentFormatId") REFERENCES "ContentFormat" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Publication_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Publication_entityTypeId_fkey" FOREIGN KEY ("entityTypeId") REFERENCES "EntityType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Publication_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PublicationCompetition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicationId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    CONSTRAINT "PublicationCompetition_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PublicationCompetition_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PublicationClassification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicationId" TEXT NOT NULL,
    "classificationId" TEXT NOT NULL,
    CONSTRAINT "PublicationClassification_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PublicationClassification_classificationId_fkey" FOREIGN KEY ("classificationId") REFERENCES "Classification" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "folderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedPost_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedPost_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "SavedFolder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedFolder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "updatedRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorLog" TEXT,
    "processingTime" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Platform_name_key" ON "Platform"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Platform_slug_key" ON "Platform"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Sport_name_key" ON "Sport"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Sport_slug_key" ON "Sport"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Competition_name_key" ON "Competition"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Competition_slug_key" ON "Competition"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "EntityType_name_key" ON "EntityType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EntityType_slug_key" ON "EntityType"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ContentFormat_name_key" ON "ContentFormat"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ContentFormat_slug_key" ON "ContentFormat"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Classification_name_key" ON "Classification"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Classification_slug_key" ON "Classification"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Publication_platformId_externalPostId_key" ON "Publication"("platformId", "externalPostId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicationCompetition_publicationId_competitionId_key" ON "PublicationCompetition"("publicationId", "competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicationClassification_publicationId_classificationId_key" ON "PublicationClassification"("publicationId", "classificationId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedPost_userId_publicationId_key" ON "SavedPost"("userId", "publicationId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedFolder_userId_name_key" ON "SavedFolder"("userId", "name");
