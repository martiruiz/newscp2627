import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function getUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("scp_admin_session")?.value;
  if (!raw) return null;
  const [userId] = raw.split(":");
  return prisma.user.findUnique({ where: { id: userId } });
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ onboardingCompleted: false, user: null }, { status: 401 });
  return NextResponse.json({
    onboardingCompleted: user.onboardingCompleted,
    userType: user.userType,
    userSports: user.userSports ? JSON.parse(user.userSports) : [],
    goals: user.goals ? JSON.parse(user.goals) : [],
  });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { userType, userSports, goals } = body;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
      userType: userType ?? null,
      userSports: userSports?.length ? JSON.stringify(userSports) : null,
      goals: goals?.length ? JSON.stringify(goals) : null,
    },
  });

  return NextResponse.json({ ok: true });
}
