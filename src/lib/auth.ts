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
      },
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
