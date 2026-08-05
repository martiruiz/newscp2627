import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/csv-parser";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  if (!category) {
    const [sports, entities, competitions, platforms, formats, clubs, classifications, contentCategories] = await Promise.all([
      prisma.sport.count(),
      prisma.entityType.count(),
      prisma.competition.count(),
      prisma.platform.count(),
      prisma.contentFormat.count(),
      prisma.publication.groupBy({ by: ["entityName"], where: { entityName: { not: null } }, _count: true }),
      prisma.classification.count(),
      prisma.contentCategory.count(),
    ]);

    return NextResponse.json({
      categories: [
        { key: "sport", label: "Sport", count: sports },
        { key: "entity", label: "Entity", count: entities },
        { key: "competition", label: "Competition", count: competitions },
        { key: "club", label: "Club", count: clubs.length },
        { key: "platform", label: "Platform", count: platforms },
        { key: "format", label: "Format", count: formats },
        { key: "classification", label: "Classification", count: classifications },
        { key: "contentCategory", label: "Content Category", count: contentCategories },
      ],
    });
  }

  if (category === "club") {
    const clubs = await prisma.publication.groupBy({
      by: ["entityName"],
      where: { entityName: { not: null } },
      _count: { entityName: true },
      orderBy: { _count: { entityName: "desc" } },
    });
    return NextResponse.json({
      values: clubs
        .filter((c) => c.entityName)
        .map((c) => ({ id: c.entityName!, name: c.entityName!, count: c._count.entityName })),
    });
  }

  const HAS_PUBS = { publications: { some: {} } } as const;

  if (category === "sport") {
    const rows = await prisma.sport.findMany({
      where: HAS_PUBS, orderBy: { name: "asc" },
      include: { _count: { select: { publications: true } } },
    });
    return NextResponse.json({ values: rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, count: r._count.publications })) });
  }
  if (category === "entity") {
    const rows = await prisma.entityType.findMany({
      where: HAS_PUBS, orderBy: { name: "asc" },
      include: { _count: { select: { publications: true } } },
    });
    return NextResponse.json({ values: rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, count: r._count.publications })) });
  }
  if (category === "competition") {
    const rows = await prisma.competition.findMany({
      where: { publications: { some: {} } }, orderBy: { name: "asc" },
      include: { _count: { select: { publications: true } } },
    });
    return NextResponse.json({ values: rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, count: r._count.publications })) });
  }
  if (category === "platform") {
    const rows = await prisma.platform.findMany({
      where: HAS_PUBS, orderBy: { name: "asc" },
      include: { _count: { select: { publications: true } } },
    });
    return NextResponse.json({ values: rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, count: r._count.publications })) });
  }
  if (category === "format") {
    const rows = await prisma.contentFormat.findMany({
      where: HAS_PUBS, orderBy: { name: "asc" },
      include: { _count: { select: { publications: true } } },
    });
    return NextResponse.json({ values: rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, count: r._count.publications })) });
  }
  if (category === "classification") {
    const rows = await prisma.classification.findMany({
      where: { publications: { some: {} } }, orderBy: { name: "asc" },
      include: { _count: { select: { publications: true } } },
    });
    return NextResponse.json({ values: rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, count: r._count.publications })) });
  }
  if (category === "contentCategory") {
    const rows = await prisma.contentCategory.findMany({
      where: { publications: { some: {} } }, orderBy: { name: "asc" },
      include: { _count: { select: { publications: true } } },
    });
    return NextResponse.json({ values: rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, count: r._count.publications })) });
  }

  return NextResponse.json({ values: [] });
}

export async function POST(request: NextRequest) {
  const { category, name } = await request.json();
  if (!category || !name) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const slug = slugify(name.trim());

  try {
    if (category === "sport") {
      const row = await prisma.sport.upsert({ where: { slug }, create: { name: name.trim(), slug }, update: {} });
      return NextResponse.json({ id: row.id, name: row.name, slug: row.slug });
    }
    if (category === "entity") {
      const row = await prisma.entityType.upsert({ where: { slug }, create: { name: name.trim(), slug }, update: {} });
      return NextResponse.json({ id: row.id, name: row.name, slug: row.slug });
    }
    if (category === "competition") {
      const row = await prisma.competition.upsert({ where: { slug }, create: { name: name.trim(), slug }, update: {} });
      return NextResponse.json({ id: row.id, name: row.name, slug: row.slug });
    }
    if (category === "platform") {
      const row = await prisma.platform.upsert({ where: { slug }, create: { name: name.trim(), slug }, update: {} });
      return NextResponse.json({ id: row.id, name: row.name, slug: row.slug });
    }
    if (category === "format") {
      const row = await prisma.contentFormat.upsert({ where: { slug }, create: { name: name.trim(), slug }, update: {} });
      return NextResponse.json({ id: row.id, name: row.name, slug: row.slug });
    }
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Already exists" }, { status: 409 });
  }
}

export async function PATCH(request: NextRequest) {
  const { category, id, name } = await request.json();
  if (!category || !id || !name?.trim()) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const slug = slugify(name.trim());
  try {
    if (category === "sport") {
      const row = await prisma.sport.update({ where: { id }, data: { name: name.trim(), slug } });
      return NextResponse.json({ id: row.id, name: row.name, slug: row.slug });
    }
    if (category === "entity") {
      const row = await prisma.entityType.update({ where: { id }, data: { name: name.trim(), slug } });
      return NextResponse.json({ id: row.id, name: row.name, slug: row.slug });
    }
    if (category === "competition") {
      const row = await prisma.competition.update({ where: { id }, data: { name: name.trim(), slug } });
      return NextResponse.json({ id: row.id, name: row.name, slug: row.slug });
    }
    if (category === "platform") {
      const row = await prisma.platform.update({ where: { id }, data: { name: name.trim(), slug } });
      return NextResponse.json({ id: row.id, name: row.name, slug: row.slug });
    }
    if (category === "format") {
      const row = await prisma.contentFormat.update({ where: { id }, data: { name: name.trim(), slug } });
      return NextResponse.json({ id: row.id, name: row.name, slug: row.slug });
    }
    if (category === "classification") {
      const row = await prisma.classification.update({ where: { id }, data: { name: name.trim(), slug } });
      return NextResponse.json({ id: row.id, name: row.name, slug: row.slug });
    }
    if (category === "contentCategory") {
      const row = await prisma.contentCategory.update({ where: { id }, data: { name: name.trim(), slug } });
      return NextResponse.json({ id: row.id, name: row.name, slug: row.slug });
    }
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Name already exists or not found" }, { status: 409 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const id = searchParams.get("id");
  if (!category || !id) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  try {
    if (category === "sport") await prisma.sport.delete({ where: { id } });
    else if (category === "entity") await prisma.entityType.delete({ where: { id } });
    else if (category === "competition") await prisma.competition.delete({ where: { id } });
    else if (category === "platform") await prisma.platform.delete({ where: { id } });
    else if (category === "format") await prisma.contentFormat.delete({ where: { id } });
    else if (category === "classification") await prisma.classification.delete({ where: { id } });
    else if (category === "contentCategory") await prisma.contentCategory.delete({ where: { id } });
    else return NextResponse.json({ error: "Unknown category" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Cannot delete: in use or not found" }, { status: 409 });
  }
}
