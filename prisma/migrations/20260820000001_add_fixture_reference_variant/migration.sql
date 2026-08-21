-- CreateTable: Fixture
CREATE TABLE IF NOT EXISTS "Fixture" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "userId"      TEXT NOT NULL,
  "sport"       TEXT,
  "homeTeam"    TEXT NOT NULL,
  "awayTeam"    TEXT NOT NULL,
  "homeCrest"   TEXT,
  "awayCrest"   TEXT,
  "competition" TEXT,
  "matchday"    TEXT,
  "venue"       TEXT,
  "kickoffAt"   TEXT,
  "timezone"    TEXT NOT NULL DEFAULT 'Europe/Madrid',
  "durationMin" INTEGER,
  "status"      TEXT NOT NULL DEFAULT 'scheduled',
  "homeScore"   INTEGER,
  "awayScore"   INTEGER,
  "notes"       TEXT,
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Fixture_userId_idx" ON "Fixture"("userId");
CREATE INDEX IF NOT EXISTS "Fixture_kickoffAt_idx" ON "Fixture"("kickoffAt");

-- CreateTable: ContentReference
CREATE TABLE IF NOT EXISTS "ContentReference" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "calendarItemId" TEXT NOT NULL,
  "publicationId"  TEXT NOT NULL,
  "adaptationNote" TEXT,
  "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ContentReference_calendarItemId_idx" ON "ContentReference"("calendarItemId");
CREATE INDEX IF NOT EXISTS "ContentReference_publicationId_idx" ON "ContentReference"("publicationId");

-- CreateTable: ContentVariant
CREATE TABLE IF NOT EXISTS "ContentVariant" (
  "id"             TEXT NOT NULL PRIMARY KEY,
  "calendarItemId" TEXT NOT NULL,
  "platform"       TEXT NOT NULL,
  "format"         TEXT,
  "copy"           TEXT,
  "hashtags"       TEXT,
  "durationSec"    INTEGER,
  "dimensions"     TEXT,
  "plannedAt"      TEXT,
  "status"         TEXT NOT NULL DEFAULT 'planned',
  "publishedUrl"   TEXT,
  "metrics"        TEXT,
  "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ContentVariant_calendarItemId_idx" ON "ContentVariant"("calendarItemId");

-- AlterTable: ContentPlan — add fixtureId
ALTER TABLE "ContentPlan" ADD COLUMN "fixtureId" TEXT REFERENCES "Fixture"("id");
