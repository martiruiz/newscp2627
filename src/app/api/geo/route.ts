import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Lightweight country → currency mapping for LATAM peso countries
const COUNTRY_CURRENCY: Record<string, { code: string; symbol: string; rate: number; locale: string }> = {
  AR: { code: "ARS", symbol: "$", rate: 1100, locale: "es-AR" },
  CL: { code: "CLP", symbol: "$", rate: 950,  locale: "es-CL" },
  CO: { code: "COP", symbol: "$", rate: 4400, locale: "es-CO" },
  MX: { code: "MXN", symbol: "$", rate: 19,   locale: "es-MX" },
  UY: { code: "UYU", symbol: "$", rate: 42,   locale: "es-UY" },
  PY: { code: "PYG", symbol: "₲", rate: 8000, locale: "es-PY" },
  PE: { code: "PEN", symbol: "S/", rate: 4.0,  locale: "es-PE" },
  BO: { code: "BOB", symbol: "Bs", rate: 7.7,  locale: "es-BO" },
  EC: { code: "USD", symbol: "$", rate: 1.08,  locale: "es-EC" },
  VE: { code: "USD", symbol: "$", rate: 1.08,  locale: "es-VE" },
  CR: { code: "CRC", symbol: "₡", rate: 580,  locale: "es-CR" },
  DO: { code: "DOP", symbol: "$", rate: 63,   locale: "es-DO" },
};

export async function GET(request: NextRequest) {
  // Try to get IP from headers (works behind proxy/CDN)
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : null;

  if (!ip || ip === "::1" || ip === "127.0.0.1") {
    return NextResponse.json({ country: null, currency: null });
  }

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`, {
      next: { revalidate: 3600 },
    });
    const data = await res.json();
    const cc: string = data.countryCode || "";
    const currency = COUNTRY_CURRENCY[cc] || null;
    return NextResponse.json({ country: cc, currency });
  } catch {
    return NextResponse.json({ country: null, currency: null });
  }
}
