import { SignInForm } from "@/components/signin-form";
import { authClient } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function SignInPage() {
  const cookie = await cookies();
  const { data: session, error } = await authClient.getSession({
    fetchOptions: {
      headers: {
        Cookie: cookie.toString(),
      },
    },
  });
  if (session != null) {
    redirect("/projects");
  }
  return <SignInForm />;
}
