import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notify";
import {
  parseCSVPreview,
  parseCSVStream,
  parseCSVFromStream,
  countCSVRows,
  validateRow,
  normalizeEntityType,
  normalizeSport,
  normalizeFormat,
  normalizePlatform,
  slugify,
  type CSVRow,
} from "@/lib/csv-parser";

export const maxDuration = 600;

// Only these values are accepted — anything else is silently discarded
const VALID_PLATFORMS = new Set(["Instagram", "TikTok", "YouTube", "Twitter", "X", "Facebook", "LinkedIn", "Pinterest"]);
const VALID_FORMATS   = new Set(["Image", "Video", "Reel", "Carousel", "Story"]);

function decodeCSV(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // UTF-16 LE (FF FE BOM)
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(buffer);
  // UTF-16 BE (FE FF BOM)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(buffer);
  // Strip UTF-8 BOM (EF BB BF) at buffer level before decoding, so Latin-1 fallback
  // doesn't render it as the 3-char sequence ï»¿ and break column detection.
  const content = (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
    ? buffer.slice(3)
    : buffer;
  // Try strict UTF-8 first
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(content);
  } catch {
    // Fall back to Latin-1 for files with non-UTF-8 bytes (common Excel export)
    return new TextDecoder("latin1").decode(content);
  }
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const action = formData.get("action") as string;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  if (action === "preview") {
    // Only read first 500 KB for preview — enough to detect columns and sample rows
    const sliceSize = 500 * 1024;
    const sliceBuffer = await file.slice(0, sliceSize).arrayBuffer();
    const text = decodeCSV(sliceBuffer);
    return handlePreview(text, file.name, file.size);
  }

  if (action === "import") {
    return handleImport(file, file.name);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

async function handlePreview(text: string, filename: string, actualFileSize?: number) {
  const SAMPLE_SIZE = 5000;
  const SLICE_SIZE = 500 * 1024;
  const { rows, headers, totalRows: sliceTotalRows, error } = parseCSVPreview(text, SAMPLE_SIZE);
  // If we only sent a 500 KB slice, estimate total rows by scaling
  const isSliced = !!actualFileSize && actualFileSize > SLICE_SIZE;
  const totalRows = isSliced && sliceTotalRows > 0
    ? Math.round(sliceTotalRows * (actualFileSize! / SLICE_SIZE))
    : sliceTotalRows;

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
    if (row.format) { const f = normalizeFormat(row.format); if (VALID_FORMATS.has(f)) formats.add(f); }
    if (row.platform) { const p = normalizePlatform(row.platform); if (VALID_PLATFORMS.has(p)) platforms.add(p); }
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

function handleImport(file: File, filename: string) {
  const encoder = new TextEncoder();
  // Estimate row count from file size: avg ~300 bytes/row in these CSVs
  const estimatedRows = Math.max(1, Math.round(file.size / 300));

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      }

      const startTime = Date.now();

      const batch = await prisma.importBatch.create({
        data: { filename, totalRows: estimatedRows, status: "processing" },
      });

      const platformCache = new Map<string, string>();
      const sportCache = new Map<string, string>();
      const competitionCache = new Map<string, string>();
      const entityTypeCache = new Map<string, string>();
      const formatCache = new Map<string, string>();

      // Pre-warm taxonomy caches with all existing records to avoid per-row DB calls
      const [existingPlatforms, existingSports, existingEntities, existingFormats, existingCompetitions] = await Promise.all([
        prisma.platform.findMany({ select: { id: true, name: true } }),
        prisma.sport.findMany({ select: { id: true, name: true } }),
        prisma.entityType.findMany({ select: { id: true, name: true } }),
        prisma.contentFormat.findMany({ select: { id: true, name: true } }),
        prisma.competition.findMany({ select: { id: true, name: true } }),
      ]);
      for (const r of existingPlatforms) platformCache.set(normalizePlatform(r.name), r.id);
      for (const r of existingSports) sportCache.set(normalizeSport(r.name), r.id);
      for (const r of existingEntities) entityTypeCache.set(normalizeEntityType(r.name), r.id);
      for (const r of existingFormats) formatCache.set(normalizeFormat(r.name), r.id);
      for (const r of existingCompetitions) competitionCache.set(r.name.trim(), r.id);

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

      let totalRows = estimatedRows;
      send({ type: "start", totalRows });

      await parseCSVFromStream(file.stream(), async (chunk: CSVRow[]) => {
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
          const rawPlatform = item.row.platform || "Instagram";
          const platformName = normalizePlatform(rawPlatform);
          if (!VALID_PLATFORMS.has(platformName)) {
            invalid++;
            errorLog.push({ row: item.rowIndex, externalId: item.validation.postId, url: item.row.url || "", errorCode: "INVALID_PLATFORM", explanation: `Platform "${rawPlatform}" is not supported. Accepted: Instagram, TikTok, YouTube, Twitter/X, Facebook, LinkedIn, Pinterest.` });
            processed++;
            continue;
          }
          const platformId = await getOrCreate(platformCache, rawPlatform, normalizePlatform, prisma.platform);
          const key = `${platformId}:${item.validation.postId}`;
          postIdToPlatform.set(key, platformId);
          rowsByKey.set(key, item);
        }

        // Batch lookup existing publications
        const postIds = validRows.map((v) => v.validation.postId);
        const existingPubs = postIds.length > 0
          ? await prisma.publication.findMany({
              where: { externalPostId: { in: postIds } },
              select: {
                id: true, platformId: true, externalPostId: true, accountUsername: true, entityName: true,
                sports: { select: { sportId: true } },
                entityTypes: { select: { entityTypeId: true } },
              },
            })
          : [];

        const existingByKey = new Map<string, typeof existingPubs[number]>();
        for (const pub of existingPubs) {
          existingByKey.set(`${pub.platformId}:${pub.externalPostId}`, pub);
        }

        // Collect sport/entityType links to add to existing pubs
        const sportLinksToAdd: Array<{ publicationId: string; sportId: string }> = [];
        const entityTypeLinksToAdd: Array<{ publicationId: string; entityTypeId: string }> = [];

        // Process: batch updates + batch creates
        const toUpdate: Array<{ id: string; data: Record<string, unknown> }> = [];
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
          entityName: string | null;
          importBatchId: string;
          importStatus: string;
          reviewStatus: string;
        }> = [];
        const sportsToCreate: Array<{ postId: string; sportIds: string[] }> = [];
        const entityTypesToCreate: Array<{ postId: string; entityTypeIds: string[] }> = [];
        const competitionsToCreate: Array<{ postId: string; competitionIds: string[] }> = [];

        for (const [key, item] of rowsByKey) {
          try {
            const platformId = postIdToPlatform.get(key)!;
            const existing = existingByKey.get(key);

            if (existing) {
              let needsUpdate = false;
              const updateData: Record<string, unknown> = {};
              if (!existing.accountUsername && item.validation.accountUsername) { updateData.accountUsername = item.validation.accountUsername; needsUpdate = true; }
              if (!existing.entityName && item.row.club) { updateData.entityName = item.row.club.trim(); needsUpdate = true; }

              // Add sports if not yet linked
              if (existing.sports.length === 0 && item.row.sport) {
                const names = item.row.sport.split(",").map((s) => s.trim()).filter(Boolean);
                for (const name of names) {
                  const id = await getOrCreate(sportCache, name, normalizeSport, prisma.sport);
                  sportLinksToAdd.push({ publicationId: existing.id, sportId: id });
                }
              }
              // Add entity types if not yet linked
              if (existing.entityTypes.length === 0 && item.row.entity) {
                const names = item.row.entity.split(",").map((e) => e.trim()).filter(Boolean);
                for (const name of names) {
                  const id = await getOrCreate(entityTypeCache, name, normalizeEntityType, prisma.entityType);
                  entityTypeLinksToAdd.push({ publicationId: existing.id, entityTypeId: id });
                }
              }

              if (needsUpdate) {
                toUpdate.push({ id: existing.id, data: updateData });
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

            // Sports — split comma-separated values
            const sportNames = item.row.sport ? item.row.sport.split(",").map((s) => s.trim()).filter(Boolean) : [];
            const sportIds: string[] = [];
            for (const name of sportNames) {
              sportIds.push(await getOrCreate(sportCache, name, normalizeSport, prisma.sport));
            }

            // Entity types — split comma-separated values
            const entityTypeNames = item.row.entity ? item.row.entity.split(",").map((e) => e.trim()).filter(Boolean) : [];
            const entityTypeIds: string[] = [];
            for (const name of entityTypeNames) {
              entityTypeIds.push(await getOrCreate(entityTypeCache, name, normalizeEntityType, prisma.entityType));
            }

            const formatName = item.row.format ? normalizeFormat(item.row.format) : null;
            const contentFormatId = (formatName && VALID_FORMATS.has(formatName))
              ? await getOrCreate(formatCache, item.row.format!, normalizeFormat, prisma.contentFormat)
              : null;

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
              entityName: item.row.club?.trim() || null,
              importBatchId: batch.id,
              importStatus: "imported",
              reviewStatus: "pending",
            });

            if (sportIds.length > 0) sportsToCreate.push({ postId: item.validation.postId, sportIds });
            if (entityTypeIds.length > 0) entityTypesToCreate.push({ postId: item.validation.postId, entityTypeIds });
            if (competitionIds.length > 0) competitionsToCreate.push({ postId: item.validation.postId, competitionIds });

            imported++;
          } catch (e) {
            failed++;
            if (errorLog.length < 100) {
              errorLog.push({ row: item.rowIndex + 2, externalId: item.row.external_id, url: item.row.url || "", errorCode: "PROCESSING_ERROR", explanation: (e as Error).message });
            }
          }
        }

        // Batch all scalar updates in a single transaction
        if (toUpdate.length > 0) {
          await prisma.$transaction(
            toUpdate.map(({ id, data }) => prisma.publication.update({ where: { id }, data }))
          );
        }

        // Add sport/entityType links for existing pubs that had none
        if (sportLinksToAdd.length > 0) {
          await prisma.publicationSport.createMany({ data: sportLinksToAdd });
        }
        if (entityTypeLinksToAdd.length > 0) {
          await prisma.publicationEntityType.createMany({ data: entityTypeLinksToAdd });
        }

        // Batch insert new publications and link all relations
        if (toCreate.length > 0) {
          await prisma.publication.createMany({ data: toCreate });

          const needsLinks = sportsToCreate.length > 0 || entityTypesToCreate.length > 0 || competitionsToCreate.length > 0;
          if (needsLinks) {
            const allPostIds = [...new Set([
              ...sportsToCreate.map((s) => s.postId),
              ...entityTypesToCreate.map((e) => e.postId),
              ...competitionsToCreate.map((c) => c.postId),
            ])];
            const createdPubs = await prisma.publication.findMany({
              where: { importBatchId: batch.id, externalPostId: { in: allPostIds } },
              select: { id: true, externalPostId: true },
            });
            const pubIdMap = new Map(createdPubs.map((p) => [p.externalPostId, p.id]));

            const sportLinks: Array<{ publicationId: string; sportId: string }> = [];
            for (const { postId, sportIds } of sportsToCreate) {
              const pubId = pubIdMap.get(postId);
              if (pubId) for (const sId of sportIds) sportLinks.push({ publicationId: pubId, sportId: sId });
            }
            if (sportLinks.length > 0) await prisma.publicationSport.createMany({ data: sportLinks });

            const entityTypeLinks: Array<{ publicationId: string; entityTypeId: string }> = [];
            for (const { postId, entityTypeIds } of entityTypesToCreate) {
              const pubId = pubIdMap.get(postId);
              if (pubId) for (const eId of entityTypeIds) entityTypeLinks.push({ publicationId: pubId, entityTypeId: eId });
            }
            if (entityTypeLinks.length > 0) await prisma.publicationEntityType.createMany({ data: entityTypeLinks });

            const compLinks: Array<{ publicationId: string; competitionId: string }> = [];
            for (const { postId, competitionIds } of competitionsToCreate) {
              const pubId = pubIdMap.get(postId);
              if (pubId) for (const cId of competitionIds) compLinks.push({ publicationId: pubId, competitionId: cId });
            }
            if (compLinks.length > 0) await prisma.publicationCompetition.createMany({ data: compLinks });
          }
        }

        processed += chunk.length;
        // Update totalRows estimate as we process (the initial estimate may be off)
        if (processed > totalRows) totalRows = Math.round(processed * 1.05);
        const elapsed = Date.now() - startTime;
        const rate = processed / elapsed;
        const remaining = Math.round((totalRows - processed) / rate);

        send({
          type: "progress",
          processed,
          totalRows,
          percent: Math.min(99, Math.round((processed / totalRows) * 100)),
          imported,
          updated,
          skipped,
          invalid,
          failed,
          elapsedMs: elapsed,
          etaMs: remaining,
        });
      }, 2000);

      const processingTime = Date.now() - startTime;
      // Use actual processed count as final totalRows
      totalRows = processed;

      await prisma.importBatch.update({
        where: { id: batch.id },
        data: {
          totalRows: processed,
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

      // Notify when new content was imported
      if (imported > 0 || updated > 0) {
        createNotification(
          "Nou contingut disponible",
          `${imported + updated} publicació${imported + updated !== 1 ? "ns" : ""} afegida${imported + updated !== 1 ? "es" : ""} a la Content Library.`,
          "content"
        ).catch(() => {});
      }

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
