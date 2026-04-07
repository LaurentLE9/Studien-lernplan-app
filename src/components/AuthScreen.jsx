import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signUpWithEmail, signInWithEmail, requestPasswordReset, resendSignupConfirmation } from "@/lib/cloudStore";
import { BookOpen } from "lucide-react";

export default function AuthScreen({ onAuthSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [showResendConfirm, setShowResendConfirm] = useState(false);

  const getFriendlyAuthError = (message) => {
    const text = String(message || "");
    const lower = text.toLowerCase();
    if (lower.includes("email rate limit exceeded") || lower.includes("rate limit")) {
      return "Zu viele Bestätigungs-E-Mails in kurzer Zeit. Warte ein paar Minuten und versuche es erneut. Wenn der Account schon erstellt wurde, wechsle auf Sign In.";
    }
    if (lower.includes("already registered") || lower.includes("already been registered") || lower.includes("user already")) {
      return "Diese E-Mail ist bereits registriert. Bitte melde dich mit Sign In an oder sende die Bestätigungs-E-Mail erneut.";
    }
    if (lower.includes("email not confirmed") || lower.includes("not confirmed")) {
      return "E-Mail noch nicht bestätigt. Bitte bestätige die E-Mail oder sende sie erneut.";
    }
    if (lower.includes("is invalid") || lower.includes("email address")) {
      return "Bitte verwende eine echte, gültige E-Mail-Adresse (z. B. deine normale Mailadresse statt test@example.com).";
    }
    return text || "Authentication failed";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setShowResendConfirm(false);
    setLoading(true);

    try {
      if (!email || !password) {
        throw new Error("Email and password required");
      }

      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      let result;
      if (isSignUp) {
        result = await signUpWithEmail(email, password);
      } else {
        result = await signInWithEmail(email, password);
      }

      if (result.session) {
        onAuthSuccess(result);
      } else if (isSignUp) {
        setInfo("Account erstellt. Bitte prüfe dein E-Mail-Postfach zur Bestätigung und melde dich danach an.");
      }
    } catch (err) {
      const friendly = getFriendlyAuthError(err.message);
      const lower = String(err?.message || "").toLowerCase();
      setError(friendly);
      if (
        lower.includes("already registered") ||
        lower.includes("already been registered") ||
        lower.includes("email not confirmed") ||
        lower.includes("not confirmed")
      ) {
        setShowResendConfirm(true);
        setIsSignUp(false);
      }
      console.error("Auth error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setInfo(null);

    if (!email) {
      setError("Bitte gib zuerst deine E-Mail-Adresse ein und klicke dann auf Passwort vergessen.");
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(email);
      setInfo("Passwort-Reset gesendet. Bitte prüfe dein E-Mail-Postfach.");
    } catch (err) {
      setError(getFriendlyAuthError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    setError(null);
    setInfo(null);

    if (!email) {
      setError("Bitte gib zuerst deine E-Mail-Adresse ein.");
      return;
    }

    setLoading(true);
    try {
      await resendSignupConfirmation(email);
      setInfo("Bestätigungs-E-Mail erneut gesendet. Bitte prüfe Posteingang und Spam-Ordner.");
      setShowResendConfirm(false);
    } catch (err) {
      setError(getFriendlyAuthError(err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 p-4">
      <Card className="w-full max-w-md rounded-2xl border-slate-700 bg-slate-900/50 backdrop-blur">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <BookOpen className="h-6 w-6" />
            </div>
          </div>
          <CardTitle className="text-2xl text-white">
            {isSignUp ? "Create Account" : "Sign In"}
          </CardTitle>
          <p className="text-sm text-slate-400 mt-2">Studien- & Lernplan</p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-200">Email</label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border-slate-600 bg-slate-800 text-white placeholder:text-slate-500"
                disabled={loading}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-200">Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg border-slate-600 bg-slate-800 text-white placeholder:text-slate-500"
                disabled={loading}
              />
              {isSignUp && (
                <p className="text-xs text-slate-400">At least 6 characters</p>
              )}
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {info && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-300">
                {info}
              </div>
            )}

            {showResendConfirm ? (
              <button
                type="button"
                onClick={handleResendConfirmation}
                className="text-xs text-slate-200 underline underline-offset-4 hover:text-white"
                disabled={loading}
              >
                Bestätigungs-E-Mail erneut senden
              </button>
            ) : null}

            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg h-10 bg-primary hover:bg-primary/90"
            >
              {loading ? "Loading..." : isSignUp ? "Create Account" : "Sign In"}
            </Button>

            {!isSignUp ? (
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs text-slate-200 underline underline-offset-4 hover:text-white"
                disabled={loading}
              >
                Passwort vergessen?
              </button>
            ) : null}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-slate-900/50 text-slate-400">or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="w-full rounded-lg h-10 border border-slate-500 bg-slate-800 text-slate-100 font-medium transition-colors hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-500"
              disabled={loading}
            >
              {isSignUp ? "Already have an account? Sign In" : "Create new account"}
            </button>

            <p className="text-xs text-slate-500 text-center mt-2">
              Verwende für die Registrierung eine echte E-Mail-Adresse.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
