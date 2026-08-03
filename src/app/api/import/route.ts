import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parseCSV,
  validateRow,
  normalizeEntityType,
  normalizeSport,
  normalizeFormat,
  normalizePlatform,
  slugify,
  type CSVRow,
} from "@/lib/csv-parser";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const action = formData.get("action") as string;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const text = await file.text();
  const { rows, headers, error } = parseCSV(text);

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  if (action === "preview") {
    return handlePreview(rows, headers, file.name);
  }

  if (action === "import") {
    return handleImport(rows, file.name);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

async function handlePreview(rows: CSVRow[], headers: string[], filename: string) {
  let validCount = 0;
  let invalidCount = 0;
  const sports = new Set<string>();
  const competitions = new Set<string>();
  const entities = new Set<string>();
  const formats = new Set<string>();
  const platforms = new Set<string>();
  const errors: Array<{ row: number; externalId: string; error: string }> = [];

  const existingIds = new Set<string>();
  const allShortcodes = rows.map((r) => r.external_id).filter(Boolean);

  const existingPubs = await prisma.publication.findMany({
    where: { externalPostId: { in: allShortcodes } },
    select: { externalPostId: true },
  });
  existingPubs.forEach((p) => existingIds.add(p.externalPostId));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const validation = validateRow(row);

    if (!validation.valid) {
      invalidCount++;
      errors.push({
        row: i + 2,
        externalId: row.external_id,
        error: validation.errors.join("; "),
      });
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

  return NextResponse.json({
    filename,
    totalRows: rows.length,
    headers,
    validRows: validCount,
    invalidRows: invalidCount,
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
    errors: errors.slice(0, 20),
  });
}

function handleImport(rows: CSVRow[], filename: string) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      }

      const startTime = Date.now();

      const batch = await prisma.importBatch.create({
        data: { filename, totalRows: rows.length, status: "processing" },
      });

      const platformCache = new Map<string, string>();
      const sportCache = new Map<string, string>();
      const competitionCache = new Map<string, string>();
      const entityTypeCache = new Map<string, string>();
      const formatCache = new Map<string, string>();

      async function getOrCreate(
        cache: Map<string, string>,
        name: string,
        normalize: (s: string) => string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model: any,
      ): Promise<string> {
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
      const errorLog: Array<{ row: number; externalId: string; url: string; errorCode: string; explanation: string }> = [];

      send({ type: "start", totalRows: rows.length });

      const CHUNK_SIZE = 200;
      for (let chunkStart = 0; chunkStart < rows.length; chunkStart += CHUNK_SIZE) {
        const chunk = rows.slice(chunkStart, chunkStart + CHUNK_SIZE);

        for (let i = 0; i < chunk.length; i++) {
          const rowIndex = chunkStart + i;
          const row = chunk[i];

          try {
            const validation = validateRow(row);

            if (!validation.valid) {
              invalid++;
              errorLog.push({ row: rowIndex + 2, externalId: row.external_id, url: "", errorCode: "VALIDATION_ERROR", explanation: validation.errors.join("; ") });
              continue;
            }

            const platformId = await getOrCreate(platformCache, row.platform || "Instagram", normalizePlatform, prisma.platform);

            const existing = await prisma.publication.findUnique({
              where: { platformId_externalPostId: { platformId, externalPostId: validation.postId } },
            });

            if (existing) {
              let needsUpdate = false;
              const updateData: Record<string, unknown> = {};
              if (!existing.accountUsername && validation.accountUsername) { updateData.accountUsername = validation.accountUsername; needsUpdate = true; }
              if (!existing.sportId && row.sport) { updateData.sportId = await getOrCreate(sportCache, row.sport, normalizeSport, prisma.sport); needsUpdate = true; }
              if (!existing.entityTypeId && row.entity) { updateData.entityTypeId = await getOrCreate(entityTypeCache, row.entity, normalizeEntityType, prisma.entityType); needsUpdate = true; }
              if (!existing.entityName && row.club) { updateData.entityName = row.club.trim(); needsUpdate = true; }

              if (needsUpdate) {
                await prisma.publication.update({ where: { id: existing.id }, data: updateData });
                updated++;
              } else {
                skipped++;
              }
              continue;
            }

            let publishedAt: Date | null = null;
            if (row.published_at) {
              publishedAt = new Date(row.published_at.replace(" ", "T") + "Z");
              if (isNaN(publishedAt.getTime())) publishedAt = null;
            }

            const sportId = row.sport ? await getOrCreate(sportCache, row.sport, normalizeSport, prisma.sport) : null;
            const entityTypeId = row.entity ? await getOrCreate(entityTypeCache, row.entity, normalizeEntityType, prisma.entityType) : null;
            const contentFormatId = row.format ? await getOrCreate(formatCache, row.format, normalizeFormat, prisma.contentFormat) : null;

            const competitionNames = row.competition
              ? row.competition.split(",").map((c) => c.trim()).filter(Boolean).filter((v, idx, arr) => arr.indexOf(v) === idx)
              : [];
            const competitionIds: string[] = [];
            for (const compName of competitionNames) {
              competitionIds.push(await getOrCreate(competitionCache, compName, (s) => s.trim(), prisma.competition));
            }

            await prisma.publication.create({
              data: {
                platformId,
                externalPostId: validation.postId,
                originalUrl: row.url?.trim() || null,
                canonicalUrl: validation.canonicalUrl,
                embedUrl: validation.embedUrl,
                accountUsername: validation.accountUsername,
                rawTitle: row.title || null,
                publishedAt,
                contentFormatId,
                sportId,
                entityTypeId,
                entityName: row.club?.trim() || null,
                importBatchId: batch.id,
                rawImportData: JSON.stringify(row),
                importStatus: "imported",
                competitions: { create: competitionIds.map((cId) => ({ competitionId: cId })) },
              },
            });

            imported++;
          } catch (e) {
            failed++;
            errorLog.push({ row: rowIndex + 2, externalId: row.external_id, url: row.url || "", errorCode: "PROCESSING_ERROR", explanation: (e as Error).message });
          }
        }

        const processed = Math.min(chunkStart + CHUNK_SIZE, rows.length);
        const elapsed = Date.now() - startTime;
        const rate = processed / elapsed;
        const remaining = Math.round((rows.length - processed) / rate);

        send({
          type: "progress",
          processed,
          totalRows: rows.length,
          percent: Math.round((processed / rows.length) * 100),
          imported,
          updated,
          skipped,
          invalid,
          failed,
          elapsedMs: elapsed,
          etaMs: remaining,
        });
      }

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
          errorLog: JSON.stringify(errorLog),
          processingTime,
          completedAt: new Date(),
        },
      });

      send({
        type: "done",
        batchId: batch.id,
        totalRows: rows.length,
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
