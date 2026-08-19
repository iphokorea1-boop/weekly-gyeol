"use client";

import { useActionState, useState } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { login, signup, type AuthState } from "@/app/actions/auth";

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none transition-colors focus:border-dated focus:ring-2 focus:ring-dated/25";

export default function AuthForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");

  // Both hooks always run so hook order stays stable; switching mode picks
  // which pair drives the form, and the discarded state resets naturally.
  const [loginState, loginAction, loginPending] = useActionState<
    AuthState,
    FormData
  >(login, undefined);
  const [signupState, signupAction, signupPending] = useActionState<
    AuthState,
    FormData
  >(signup, undefined);

  const isSignup = mode === "signup";
  const state = isSignup ? signupState : loginState;
  const action = isSignup ? signupAction : loginAction;
  const pending = isSignup ? signupPending : loginPending;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-5 flex items-center gap-1 rounded-full border border-border bg-surface p-1 shadow-xs">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={cn(
              "pressable flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold",
              mode === m
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-ink-soft hover:text-foreground"
            )}
          >
            {m === "login" ? (
              <LogIn className="h-3.5 w-3.5" strokeWidth={2.5} />
            ) : (
              <UserPlus className="h-3.5 w-3.5" strokeWidth={2.5} />
            )}
            {m === "login" ? "로그인" : "가입하기"}
          </button>
        ))}
      </div>

      <form
        action={action}
        className="animate-panel-in flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm"
      >
        {isSignup && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-ink-faint">이름 (선택)</span>
            <input name="name" autoComplete="name" className={inputClass} />
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-ink-faint">이메일</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-ink-faint">비밀번호</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            // Tells password managers to offer a new password on signup and the
            // saved one on login, instead of guessing from the field name.
            autoComplete={isSignup ? "new-password" : "current-password"}
            className={inputClass}
          />
          {isSignup && (
            <span className="text-[11px] text-ink-faint">8자 이상</span>
          )}
        </label>

        {state?.error && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-[13px] font-medium text-destructive"
          >
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="pressable lift mt-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-40"
        >
          {pending ? "처리 중…" : isSignup ? "가입하고 시작하기" : "로그인"}
        </button>
      </form>
    </div>
  );
}
