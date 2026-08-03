import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parseCSVPreview,
  parseCSVStream,
  countCSVRows,
  validateRow,
  normalizeEntityType,
  normalizeSport,
  normalizeFormat,
  normalizePlatform,
  slugify,
  type CSVRow,
} from "@/lib/csv-parser";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const action = formData.get("action") as string;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const text = await file.text();

  if (action === "preview") {
    return handlePreview(text, file.name);
  }

  if (action === "import") {
    return handleImport(text, file.name);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

async function handlePreview(text: string, filename: string) {
  const SAMPLE_SIZE = 5000;
  const { rows, headers, totalRows, error } = parseCSVPreview(text, SAMPLE_SIZE);

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  let validCount = 0;
  let invalidCount = 0;
  const sports = new Set<string>();
  const competitions = new Set<string>();
  const entities = new Set<string>();
  const formats = new Set<string>();
  const platforms = new Set<string>();
  const errors: Array<{ row: number; externalId: string; error: string }> = [];

  const postIds = rows.map((r) => r.external_id).filter(Boolean);
  const BATCH_SIZE = 5000;
  const existingIds = new Set<string>();
  for (let i = 0; i < postIds.length; i += BATCH_SIZE) {
    const batch = postIds.slice(i, i + BATCH_SIZE);
    const found = await prisma.publication.findMany({
      where: { externalPostId: { in: batch } },
      select: { externalPostId: true },
    });
    found.forEach((p) => existingIds.add(p.externalPostId));
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const validation = validateRow(row);

    if (!validation.valid) {
      invalidCount++;
      if (errors.length < 20) {
        errors.push({ row: i + 2, externalId: row.external_id, error: validation.errors.join("; ") });
      }
      continue;
    }
    validCount++;

    if (row.sport) sports.add(normalizeSport(row.sport));
    if (row.competition) {
      row.competition.split(",").forEach((c) => {
        const trimmed = c.trim();
        if (trimmed) competitions.add(trimmed);
      });
    }
    if (row.entity) entities.add(normalizeEntityType(row.entity));
    if (row.format) formats.add(normalizeFormat(row.format));
    if (row.platform) platforms.add(normalizePlatform(row.platform));
  }

  const sampled = rows.length < totalRows;

  return NextResponse.json({
    filename,
    totalRows,
    sampledRows: rows.length,
    sampled,
    headers,
    validRows: sampled ? Math.round((validCount / rows.length) * totalRows) : validCount,
    invalidRows: sampled ? Math.round((invalidCount / rows.length) * totalRows) : invalidCount,
    existingPublications: existingIds.size,
    newPublications: validCount - existingIds.size,
    preview: rows.slice(0, 5).map((r, i) => ({
      ...r,
      _validation: validateRow(r),
      _rowNum: i + 2,
    })),
    taxonomy: {
      sports: Array.from(sports).sort(),
      competitions: Array.from(competitions).sort(),
      entities: Array.from(entities).sort(),
      formats: Array.from(formats).sort(),
      platforms: Array.from(platforms).sort(),
    },
    errors,
  });
}

function handleImport(text: string, filename: string) {
  const encoder = new TextEncoder();
  const totalRows = countCSVRows(text);

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      }

      const startTime = Date.now();

      const batch = await prisma.importBatch.create({
        data: { filename, totalRows, status: "processing" },
      });

      const platformCache = new Map<string, string>();
      const sportCache = new Map<string, string>();
      const competitionCache = new Map<string, string>();
      const entityTypeCache = new Map<string, string>();
      const formatCache = new Map<string, string>();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async function getOrCreate(cache: Map<string, string>, name: string, normalize: (s: string) => string, model: any): Promise<string> {
        const normalized = normalize(name);
        if (cache.has(normalized)) return cache.get(normalized)!;
        const slug = slugify(normalized);
        const record = await model.upsert({
          where: { slug },
          create: { name: normalized, slug },
          update: {},
        });
        cache.set(normalized, record.id);
        return record.id;
      }

      let imported = 0;
      let updated = 0;
      let skipped = 0;
      let invalid = 0;
      let failed = 0;
      let processed = 0;
      const errorLog: Array<{ row: number; externalId: string; url: string; errorCode: string; explanation: string }> = [];

      send({ type: "start", totalRows });

      await parseCSVStream(text, async (chunk: CSVRow[]) => {
        const validRows: Array<{ row: CSVRow; validation: ReturnType<typeof validateRow>; rowIndex: number }> = [];

        for (let i = 0; i < chunk.length; i++) {
          const rowIndex = processed + i;
          const row = chunk[i];
          const validation = validateRow(row);
          if (!validation.valid) {
            invalid++;
            if (errorLog.length < 100) {
              errorLog.push({ row: rowIndex + 2, externalId: row.external_id, url: "", errorCode: "VALIDATION_ERROR", explanation: validation.errors.join("; ") });
            }
          } else {
            validRows.push({ row, validation, rowIndex });
          }
        }

        // Batch dedup check: collect all postIds for this chunk and query once
        const postIdToPlatform = new Map<string, string>();
        const rowsByKey = new Map<string, typeof validRows[number]>();

        for (const item of validRows) {
          const platformName = normalizePlatform(item.row.platform || "Instagram");
          const platformId = await getOrCreate(platformCache, item.row.platform || "Instagram", normalizePlatform, prisma.platform);
          const key = `${platformId}:${item.validation.postId}`;
          postIdToPlatform.set(key, platformId);
          rowsByKey.set(key, item);
        }

        // Batch lookup existing publications
        const postIds = validRows.map((v) => v.validation.postId);
        const existingPubs = postIds.length > 0
          ? await prisma.publication.findMany({
              where: { externalPostId: { in: postIds } },
              select: { id: true, platformId: true, externalPostId: true, accountUsername: true, sportId: true, entityTypeId: true, entityName: true },
            })
          : [];

        const existingByKey = new Map<string, typeof existingPubs[number]>();
        for (const pub of existingPubs) {
          existingByKey.set(`${pub.platformId}:${pub.externalPostId}`, pub);
        }

        // Process: batch updates + batch creates
        const toCreate: Array<{
          platformId: string;
          externalPostId: string;
          originalUrl: string | null;
          canonicalUrl: string;
          embedUrl: string;
          accountUsername: string | null;
          rawTitle: string | null;
          publishedAt: Date | null;
          contentFormatId: string | null;
          sportId: string | null;
          entityTypeId: string | null;
          entityName: string | null;
          importBatchId: string;
          importStatus: string;
        }> = [];
        const competitionsToCreate: Array<{ postId: string; competitionIds: string[] }> = [];

        for (const [key, item] of rowsByKey) {
          try {
            const platformId = postIdToPlatform.get(key)!;
            const existing = existingByKey.get(key);

            if (existing) {
              let needsUpdate = false;
              const updateData: Record<string, unknown> = {};
              if (!existing.accountUsername && item.validation.accountUsername) { updateData.accountUsername = item.validation.accountUsername; needsUpdate = true; }
              if (!existing.sportId && item.row.sport) { updateData.sportId = await getOrCreate(sportCache, item.row.sport, normalizeSport, prisma.sport); needsUpdate = true; }
              if (!existing.entityTypeId && item.row.entity) { updateData.entityTypeId = await getOrCreate(entityTypeCache, item.row.entity, normalizeEntityType, prisma.entityType); needsUpdate = true; }
              if (!existing.entityName && item.row.club) { updateData.entityName = item.row.club.trim(); needsUpdate = true; }

              if (needsUpdate) {
                await prisma.publication.update({ where: { id: existing.id }, data: updateData });
                updated++;
              } else {
                skipped++;
              }
              continue;
            }

            let publishedAt: Date | null = null;
            if (item.row.published_at) {
              publishedAt = new Date(item.row.published_at.replace(" ", "T") + "Z");
              if (isNaN(publishedAt.getTime())) publishedAt = null;
            }

            const sportId = item.row.sport ? await getOrCreate(sportCache, item.row.sport, normalizeSport, prisma.sport) : null;
            const entityTypeId = item.row.entity ? await getOrCreate(entityTypeCache, item.row.entity, normalizeEntityType, prisma.entityType) : null;
            const contentFormatId = item.row.format ? await getOrCreate(formatCache, item.row.format, normalizeFormat, prisma.contentFormat) : null;

            const competitionNames = item.row.competition
              ? item.row.competition.split(",").map((c) => c.trim()).filter(Boolean).filter((v, idx, arr) => arr.indexOf(v) === idx)
              : [];
            const competitionIds: string[] = [];
            for (const compName of competitionNames) {
              competitionIds.push(await getOrCreate(competitionCache, compName, (s) => s.trim(), prisma.competition));
            }

            toCreate.push({
              platformId,
              externalPostId: item.validation.postId,
              originalUrl: item.row.url?.trim() || null,
              canonicalUrl: item.validation.canonicalUrl,
              embedUrl: item.validation.embedUrl,
              accountUsername: item.validation.accountUsername,
              rawTitle: item.row.title || null,
              publishedAt,
              contentFormatId,
              sportId,
              entityTypeId,
              entityName: item.row.club?.trim() || null,
              importBatchId: batch.id,
              importStatus: "imported",
            });

            if (competitionIds.length > 0) {
              competitionsToCreate.push({ postId: item.validation.postId, competitionIds });
            }

            imported++;
          } catch (e) {
            failed++;
            if (errorLog.length < 100) {
              errorLog.push({ row: item.rowIndex + 2, externalId: item.row.external_id, url: item.row.url || "", errorCode: "PROCESSING_ERROR", explanation: (e as Error).message });
            }
          }
        }

        // Batch insert new publications
        if (toCreate.length > 0) {
          await prisma.publication.createMany({ data: toCreate, skipDuplicates: true });

          // Link competitions for newly created publications
          if (competitionsToCreate.length > 0) {
            const createdPubs = await prisma.publication.findMany({
              where: {
                importBatchId: batch.id,
                externalPostId: { in: competitionsToCreate.map((c) => c.postId) },
              },
              select: { id: true, externalPostId: true },
            });
            const pubIdMap = new Map(createdPubs.map((p) => [p.externalPostId, p.id]));

            const compLinks: Array<{ publicationId: string; competitionId: string }> = [];
            for (const { postId, competitionIds } of competitionsToCreate) {
              const pubId = pubIdMap.get(postId);
              if (pubId) {
                for (const cId of competitionIds) {
                  compLinks.push({ publicationId: pubId, competitionId: cId });
                }
              }
            }
            if (compLinks.length > 0) {
              await prisma.publicationCompetition.createMany({ data: compLinks, skipDuplicates: true });
            }
          }
        }

        processed += chunk.length;
        const elapsed = Date.now() - startTime;
        const rate = processed / elapsed;
        const remaining = Math.round((totalRows - processed) / rate);

        send({
          type: "progress",
          processed,
          totalRows,
          percent: Math.round((processed / totalRows) * 100),
          imported,
          updated,
          skipped,
          invalid,
          failed,
          elapsedMs: elapsed,
          etaMs: remaining,
        });
      }, 500);

      const processingTime = Date.now() - startTime;

      await prisma.importBatch.update({
        where: { id: batch.id },
        data: {
          validRows: imported + updated + skipped,
          importedRows: imported,
          updatedRows: updated,
          skippedRows: skipped,
          invalidRows: invalid,
          failedRows: failed,
          status: "completed",
          errorLog: errorLog.length > 0 ? JSON.stringify(errorLog) : null,
          processingTime,
          completedAt: new Date(),
        },
      });

      send({
        type: "done",
        batchId: batch.id,
        totalRows,
        imported,
        updated,
        skipped,
        invalid,
        failed,
        processingTime,
        errors: errorLog.slice(0, 50),
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}
