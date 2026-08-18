import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const jobs = await prisma.jobPosting.findMany({
    orderBy: [{ featured: "desc" }, { postedAt: "desc" }],
  });
  return NextResponse.json({ jobs });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, company, companyHandle, companyLogo, description, jobType, workMode, location, salary, sourceUrl, applyUrl, featured, postedAt } = body;
  if (!title || !company || !description || !sourceUrl) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const job = await prisma.jobPosting.create({
    data: {
      id: crypto.randomUUID(),
      title: title.trim(),
      company: company.trim(),
      companyHandle: companyHandle?.trim() || null,
      companyLogo: companyLogo?.trim() || null,
      description: description.trim(),
      jobType: jobType || "FULL-TIME",
      workMode: workMode?.trim() || null,
      location: location?.trim() || null,
      salary: salary?.trim() || null,
      sourceUrl: sourceUrl.trim(),
      applyUrl: applyUrl?.trim() || null,
      featured: Boolean(featured),
      postedAt: postedAt ? new Date(postedAt) : new Date(),
    },
  });
  return NextResponse.json({ job });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const data: Record<string, unknown> = {};
  const fields = ["title", "company", "companyHandle", "companyLogo", "description", "jobType", "workMode", "location", "salary", "sourceUrl", "applyUrl", "featured", "active", "postedAt"];
  for (const f of fields) {
    if (f in rest) {
      if (f === "featured" || f === "active") data[f] = Boolean(rest[f]);
      else if (f === "postedAt") data[f] = rest[f] ? new Date(rest[f] as string) : undefined;
      else data[f] = rest[f] === "" ? null : rest[f];
    }
  }
  try {
    const job = await prisma.jobPosting.update({ where: { id }, data });
    return NextResponse.json({ job });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  try {
    await prisma.jobPosting.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
