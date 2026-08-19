import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import AuthForm from "@/app/components/auth-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Someone already signed in has no reason to see this screen.
  if (await getCurrentUser()) redirect("/");

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">주간결</h1>
        <p className="mt-1.5 text-sm text-balance text-ink-soft">
          루틴, 할 일, 언젠가 할 일을 한 결로 정리합니다.
        </p>
      </div>
      <AuthForm />
    </div>
  );
}
