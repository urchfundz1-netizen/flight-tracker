import { redirect } from "next/navigation";
import { getCurrentAdmin } from "./auth.js";

/**
 * Guards admin pages. The proxy already blocks unauthenticated requests, but this
 * re-checks on the server so a page never renders for a missing or dead session.
 */
export default async function requireAdminPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
