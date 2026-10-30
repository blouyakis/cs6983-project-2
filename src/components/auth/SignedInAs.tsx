import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth/cookies";
import { UnauthorizedError } from "@/lib/http/errors";
import { getCurrentUser, type User } from "@/lib/services/auth-service";

// Reads the session, so render it inside <Suspense>.
export async function SignedInAs() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }
  let user: User;
  try {
    user = await getCurrentUser(userId);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect("/login");
    }
    throw error;
  }
  return <p>Signed in as {user.name}</p>;
}
