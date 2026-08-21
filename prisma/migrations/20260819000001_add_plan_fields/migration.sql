-- CreateTable ContentPlan
CREATE TABLE IF NOT EXISTS "ContentPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'custom',
    "sport" TEXT,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Madrid',
    "eventStartAt" TEXT,
    "eventEndAt" TEXT,
    "team" TEXT,
    "opponent" TEXT,
    "competition" TEXT,
    "venue" TEXT,
    "homeAway" TEXT,
    "mainObjective" TEXT,
    "secondaryObjective" TEXT,
    "targetAudience" TEXT,
    "platforms" TEXT NOT NULL DEFAULT '[]',
    "contentPillars" TEXT NOT NULL DEFAULT '[]',
    "teamMembers" TEXT NOT NULL DEFAULT '[]',
    "sponsors" TEXT NOT NULL DEFAULT '[]',
    "kpis" TEXT NOT NULL DEFAULT '[]',
    "clientName" TEXT,
    "coverageIntensity" TEXT,
    "colorScheme" TEXT,
    "parentPlanId" TEXT,
    "ownerId" TEXT,
    "approverId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "archivedAt" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable ContentPlanPhase
CREATE TABLE IF NOT EXISTS "ContentPlanPhase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "phaseKey" TEXT,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "anchorType" TEXT NOT NULL DEFAULT 'absolute',
    "startOffsetMinutes" INTEGER,
    "endOffsetMinutes" INTEGER,
    "startsAt" TEXT,
    "endsAt" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentPlanPhase_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ContentPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable PlanVersion
CREATE TABLE IF NOT EXISTS "PlanVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" TEXT NOT NULL,
    "submittedBy" TEXT,
    "summary" TEXT,
    "approvalState" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ContentPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable PlanComment
CREATE TABLE IF NOT EXISTS "PlanComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "itemId" TEXT,
    "authorName" TEXT NOT NULL,
    "authorEmail" TEXT,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanComment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ContentPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable ApprovalAction
CREATE TABLE IF NOT EXISTS "ApprovalAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT,
    "itemId" TEXT,
    "reviewLinkId" TEXT,
    "action" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorEmail" TEXT,
    "comment" TEXT,
    "version" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable ReviewLink
CREATE TABLE IF NOT EXISTS "ReviewLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "permissions" TEXT NOT NULL DEFAULT 'view',
    "expiresAt" TEXT,
    "revokedAt" TEXT,
    "label" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewLink_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ContentPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable PlanTemplate
CREATE TABLE IF NOT EXISTS "PlanTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sport" TEXT,
    "description" TEXT,
    "platforms" TEXT NOT NULL DEFAULT '[]',
    "contentPillars" TEXT NOT NULL DEFAULT '[]',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable PlanTemplatePhase
CREATE TABLE IF NOT EXISTS "PlanTemplatePhase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "phaseKey" TEXT,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "anchorType" TEXT NOT NULL DEFAULT 'absolute',
    "startOffsetMinutes" INTEGER,
    "endOffsetMinutes" INTEGER,
    CONSTRAINT "PlanTemplatePhase_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PlanTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable PlanTemplateItem
CREATE TABLE IF NOT EXISTS "PlanTemplateItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phaseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "platforms" TEXT NOT NULL DEFAULT '[]',
    "contentPillar" TEXT,
    "objective" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'recommended',
    "relativeTimeRule" TEXT,
    "shortConcept" TEXT,
    "hook" TEXT,
    "script" TEXT,
    "cta" TEXT,
    CONSTRAINT "PlanTemplateItem_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "PlanTemplatePhase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Alter CalendarItem to add plan-related fields (safe: adds only if not exists)
ALTER TABLE "CalendarItem" ADD COLUMN IF NOT EXISTS "planId" TEXT;
ALTER TABLE "CalendarItem" ADD COLUMN IF NOT EXISTS "phaseId" TEXT;
ALTER TABLE "CalendarItem" ADD COLUMN IF NOT EXISTS "priority" TEXT;
ALTER TABLE "CalendarItem" ADD COLUMN IF NOT EXISTS "contentPillar" TEXT;
ALTER TABLE "CalendarItem" ADD COLUMN IF NOT EXISTS "campaign" TEXT;
ALTER TABLE "CalendarItem" ADD COLUMN IF NOT EXISTS "objective" TEXT;
ALTER TABLE "CalendarItem" ADD COLUMN IF NOT EXISTS "targetAudience" TEXT;
ALTER TABLE "CalendarItem" ADD COLUMN IF NOT EXISTS "assigneeId" TEXT;
ALTER TABLE "CalendarItem" ADD COLUMN IF NOT EXISTS "productionDeadline" TEXT;
ALTER TABLE "CalendarItem" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT;
ALTER TABLE "CalendarItem" ADD COLUMN IF NOT EXISTS "approverId" TEXT;
ALTER TABLE "CalendarItem" ADD COLUMN IF NOT EXISTS "shortConcept" TEXT;
ALTER TABLE "CalendarItem" ADD COLUMN IF NOT EXISTS "whyThisIdea" TEXT;
ALTER TABLE "CalendarItem" ADD COLUMN IF NOT EXISTS "caption" TEXT;
ALTER TABLE "CalendarItem" ADD COLUMN IF NOT EXISTS "shotList" TEXT;
ALTER TABLE "CalendarItem" ADD COLUMN IF NOT EXISTS "requiredAssets" TEXT;
ALTER TABLE "CalendarItem" ADD COLUMN IF NOT EXISTS "sourceSnapshot" TEXT;
ALTER TABLE "CalendarItem" ADD COLUMN IF NOT EXISTS "relativeTimeRule" TEXT;
ALTER TABLE "CalendarItem" ADD COLUMN IF NOT EXISTS "relativeTimeManuallyOverridden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CalendarItem" ADD COLUMN IF NOT EXISTS "publishedUrl" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContentPlan_userId_idx" ON "ContentPlan"("userId");
CREATE INDEX IF NOT EXISTS "ContentPlan_userId_status_idx" ON "ContentPlan"("userId", "status");
CREATE INDEX IF NOT EXISTS "ContentPlanPhase_planId_idx" ON "ContentPlanPhase"("planId");
CREATE INDEX IF NOT EXISTS "PlanVersion_planId_idx" ON "PlanVersion"("planId");
CREATE INDEX IF NOT EXISTS "PlanComment_planId_idx" ON "PlanComment"("planId");
CREATE INDEX IF NOT EXISTS "ApprovalAction_planId_idx" ON "ApprovalAction"("planId");
CREATE UNIQUE INDEX IF NOT EXISTS "ReviewLink_tokenHash_key" ON "ReviewLink"("tokenHash");
CREATE INDEX IF NOT EXISTS "ReviewLink_planId_idx" ON "ReviewLink"("planId");
CREATE INDEX IF NOT EXISTS "PlanTemplate_userId_idx" ON "PlanTemplate"("userId");
