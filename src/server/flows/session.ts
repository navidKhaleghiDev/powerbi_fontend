import { cookies } from "next/headers";

import { SESSION_COOKIE, sessionUser } from "./auth";
export const currentUser = async () =>
  sessionUser((await cookies()).get(SESSION_COOKIE)?.value);
