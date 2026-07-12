import { redirect } from "next/navigation";

/** Homepage redirects to the role-aware dashboard route. */
export default function HomePage() {
  redirect("/dashboard");
}
