import { cookies } from "next/headers";
import { prisma } from "./prisma";

const DEFAULT_USER_ID = "default-user";

export async function getOrCreateDefaultUser() {
  let user = await prisma.user.findUnique({ where: { id: DEFAULT_USER_ID } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: DEFAULT_USER_ID,
        email: "admin@scp-nova.local",
        name: "Admin",
        password: "not-used",
        superAdmin: true,
        plan: "pro_annual",
      },
    });
  } else if (!user.superAdmin) {
    // Ensure the default user always has super admin and pro access
    user = await prisma.user.update({
      where: { id: DEFAULT_USER_ID },
      data: { superAdmin: true, plan: "pro_annual" },
    });
  }
  return user;
}

export async function getCurrentUserId(): Promise<string> {
  const cookieStore = await cookies();
  const userCookie = cookieStore.get("scp_user_id");
  if (userCookie?.value) return userCookie.value;
  const user = await getOrCreateDefaultUser();
  return user.id;
}
