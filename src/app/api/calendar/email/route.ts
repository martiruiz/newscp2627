import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import nodemailer from "nodemailer";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {
  const userId = await getCurrentUserId();
  const body = await req.json();
  const { recipients, subject, message, from, to, status, attachExcel } = body as {
    recipients: string[];
    subject: string;
    message?: string;
    from?: string;
    to?: string;
    status?: string;
    attachExcel?: boolean;
  };

  if (!recipients?.length) return NextResponse.json({ error: "No recipients" }, { status: 400 });
  if (!subject?.trim()) return NextResponse.json({ error: "Subject required" }, { status: 400 });

  const where: Record<string, unknown> = { userId };
  if (from && to) where.plannedDate = { gte: from, lte: to };
  else if (from) where.plannedDate = { gte: from };
  if (status) where.status = status;

  const items = await prisma.calendarItem.findMany({
    where,
    orderBy: [{ plannedDate: "asc" }, { plannedTime: "asc" }],
  });

  const STATUS_LABELS: Record<string, string> = {
    planned: "Planned",
    in_production: "In Production",
    ready: "Ready to Publish",
    published: "Published",
  };

  const STATUS_COLORS: Record<string, string> = {
    planned: "#3B82F6",
    in_production: "#F59E0B",
    ready: "#10B981",
    published: "#6B7280",
  };

  let grouped: Record<string, typeof items> = {};
  for (const item of items) {
    if (!grouped[item.plannedDate]) grouped[item.plannedDate] = [];
    grouped[item.plannedDate].push(item);
  }

  const calendarHtml = Object.entries(grouped).map(([date, dayItems]) => {
    const d = new Date(date + "T00:00:00");
    const dateLabel = d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const rows = dayItems.map((item) => {
      const platforms = JSON.parse(item.platforms || "[]") as string[];
      const color = STATUS_COLORS[item.status] || "#6B7280";
      const statusLabel = STATUS_LABELS[item.status] || item.status;
      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:14px;color:#111827">${item.plannedTime || "—"}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:14px;color:#111827;font-weight:500">${item.title}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB">
            <span style="background:${color}20;color:${color};padding:2px 8px;border-radius:9999px;font-size:12px;font-weight:600">${statusLabel}</span>
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#6B7280">${platforms.join(", ")}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#6B7280">${item.notes || ""}</td>
        </tr>`;
    }).join("");
    return `
      <div style="margin-bottom:24px">
        <h3 style="font-size:16px;font-weight:700;color:#0D1421;margin:0 0 8px">${dateLabel}</h3>
        <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #E5E7EB">
          <thead>
            <tr style="background:#F9FAFB">
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB">Time</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB">Content</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB">Status</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB">Platforms</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B7280;font-weight:600;border-bottom:1px solid #E5E7EB">Notes</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join("");

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:0 auto;padding:24px">
      <div style="margin-bottom:24px">
        <h1 style="font-size:24px;font-weight:800;color:#0D1421;margin:0 0 4px">Content Calendar</h1>
        ${from || to ? `<p style="font-size:14px;color:#6B7280;margin:0">${from || ""}${from && to ? " – " : ""}${to || ""}</p>` : ""}
      </div>
      ${message ? `<p style="font-size:15px;color:#374151;margin:0 0 24px">${message}</p>` : ""}
      ${items.length === 0 ? '<p style="color:#6B7280">No items in the selected range.</p>' : calendarHtml}
      <p style="font-size:12px;color:#9CA3AF;margin-top:32px">Sent from Sports Content Playbook</p>
    </div>`;

  const attachments: { filename: string; content: Buffer; contentType: string }[] = [];
  if (attachExcel) {
    const rows2 = items.map((item) => ({
      Date: item.plannedDate,
      Time: item.plannedTime || "",
      Title: item.title,
      Status: STATUS_LABELS[item.status] || item.status,
      Platforms: (JSON.parse(item.platforms || "[]") as string[]).join(", "),
      Creator: item.creatorName || "",
      Sport: item.sport || "",
      Format: item.contentFormat || "",
      Notes: item.notes || "",
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows2);
    ws["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 40 }, { wch: 16 }, { wch: 24 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws, "Content Calendar");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    attachments.push({ filename: "content-calendar.xlsx", content: buf, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@sportscontentplaybook.com",
    to: recipients.join(", "),
    subject: subject.trim(),
    html,
    attachments,
  });

  return NextResponse.json({ ok: true, sent: recipients.length });
}
