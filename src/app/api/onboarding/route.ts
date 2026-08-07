import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  const { club, competition, creator, email } = await request.json();

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const html = `
    <h2>Nova preferència d'usuari a SCP</h2>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
      <tr><td style="padding:8px 16px 8px 0;font-weight:bold;color:#555">Usuari</td><td style="padding:8px 0">${email || "—"}</td></tr>
      <tr><td style="padding:8px 16px 8px 0;font-weight:bold;color:#555">Club</td><td style="padding:8px 0">${club || "—"}</td></tr>
      <tr><td style="padding:8px 16px 8px 0;font-weight:bold;color:#555">Competició</td><td style="padding:8px 0">${competition || "—"}</td></tr>
      <tr><td style="padding:8px 16px 8px 0;font-weight:bold;color:#555">Creador favorit</td><td style="padding:8px 0">${creator || "—"}</td></tr>
    </table>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER || "noreply@sportscontentplaybook.com",
      to: "info@sportscontentplaybook.com",
      subject: `[SCP] Nou usuari: ${club || "sense club"}`,
      html,
    });
  } catch (err) {
    console.error("[onboarding] email error:", err);
  }

  return NextResponse.json({ ok: true });
}
