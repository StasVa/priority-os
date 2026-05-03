import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/decision/LanguageSwitcher";
import { ThemeToggle } from "@/components/decision/ThemeToggle";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/useAuth";

type Mode = "signIn" | "signUp";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const Login = () => {
  const { t } = useTranslation();
  const { signIn, signUp, resendSignUp } = useAuth();

  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0); // seconds remaining
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => {
      setResendCooldown((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!EMAIL_RE.test(email.trim())) {
      setError(t("login.errors.invalidEmail"));
      return;
    }
    if (password.length < 6) {
      setError(t("login.errors.passwordTooShort"));
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signIn") {
        await signIn(email.trim(), password);
      } else {
        const { needsConfirmation } = await signUp(email.trim(), password, {
          displayName: displayName.trim() || undefined,
        });
        if (needsConfirmation) {
          setConfirmationSentTo(email.trim());
          setResendCooldown(60);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === "signIn" ? "signUp" : "signIn"));
    setError(null);
    setConfirmationSentTo(null);
  };

  const startOver = () => {
    setConfirmationSentTo(null);
    setEmail("");
    setPassword("");
    setDisplayName("");
    setError(null);
    setResendCooldown(0);
    setResending(false);
  };

  const handleResend = async () => {
    if (!confirmationSentTo || resending || resendCooldown > 0) return;
    setResending(true);
    setError(null);
    try {
      await resendSignUp(confirmationSentTo);
      setResendCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setResending(false);
    }
  };

  const resendLabel = resending
    ? t("login.signUp.checkEmail.resending")
    : resendCooldown > 0
      ? t("login.signUp.checkEmail.resendIn", { seconds: resendCooldown })
      : t("login.signUp.checkEmail.resend");

  const confirmationSent = !!confirmationSentTo && mode === "signUp";

  const buttonLabel = submitting
    ? t("login.loading")
    : mode === "signIn"
      ? t("login.signIn.button")
      : t("login.signUp.button");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="absolute top-4 right-6 flex items-center gap-3">
        <LanguageSwitcher />
        <span className="w-px h-5 bg-border mx-1" aria-hidden />
        <ThemeToggle />
      </div>

      <main className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-[400px]">
          <div className="text-center mb-10 select-none">
            <div className="flex items-baseline justify-center gap-1.5">
              <span
                className="font-serif text-4xl font-semibold tracking-tight"
                style={{ fontVariationSettings: '"opsz" 144' }}
              >
                Priority
              </span>
              <span className="font-serif italic text-2xl text-muted-foreground font-light">
                OS
              </span>
            </div>
            <p className="mt-3 font-serif italic text-base text-muted-foreground">
              {t("login.subtitle")}
            </p>
          </div>

          <h1 className="font-serif text-xl mb-6">
            {mode === "signIn" ? t("login.signIn.heading") : t("login.signUp.heading")}
          </h1>

          {confirmationSent ? (
            <>
              <div
                className="mb-5 p-4 rounded-lg border border-border bg-muted/40"
                role="status"
                aria-live="polite"
              >
                <p className="font-serif text-sm leading-relaxed">
                  {t("login.signUp.checkEmail.title", { email: confirmationSentTo })}
                </p>
                <p className="mt-2 font-serif italic text-xs text-muted-foreground">
                  {t("login.signUp.checkEmail.body")}
                </p>
                <p className="mt-3 font-serif italic text-xs text-muted-foreground">
                  {t("login.signUp.checkEmail.spamHint")}
                </p>
              </div>

              <button
                type="button"
                onClick={handleResend}
                disabled={resending || resendCooldown > 0}
                className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-ink text-paper text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed ease-editorial transition-opacity"
              >
                <span className="font-serif">{resendLabel}</span>
              </button>

              {error && (
                <p className="mt-3 text-sm text-destructive font-serif" role="alert">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={startOver}
                className="mt-4 w-full text-center font-serif italic text-sm text-muted-foreground hover:text-foreground ease-editorial transition-colors"
              >
                {t("login.signUp.useDifferentEmail")}
              </button>
            </>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block font-mono text-[11px] uppercase tracking-wide text-muted-foreground"
                >
                  {t("login.fields.email")}
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="block font-mono text-[11px] uppercase tracking-wide text-muted-foreground"
                >
                  {t("login.fields.password")}
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signIn" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  required
                  minLength={6}
                />
              </div>

              {mode === "signUp" && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="displayName"
                    className="block font-mono text-[11px] uppercase tracking-wide text-muted-foreground"
                  >
                    {t("login.fields.displayName")}
                  </label>
                  <Input
                    id="displayName"
                    type="text"
                    autoComplete="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive font-serif" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-ink text-paper text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed ease-editorial transition-opacity"
              >
                <span className="font-serif">{buttonLabel}</span>
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={toggleMode}
            disabled={submitting}
            className="mt-6 w-full text-center font-serif italic text-sm text-muted-foreground hover:text-foreground ease-editorial transition-colors"
          >
            {mode === "signIn" ? t("login.toggle.toSignUp") : t("login.toggle.toSignIn")}
          </button>
        </div>
      </main>
    </div>
  );
};

export default Login;
