import React, { useState } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  requestPasswordReset,
  resendSignupConfirmation,
  signInWithEmail,
  signUpWithEmail,
} from "@/lib/cloudStore";

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
      return "Zu viele Bestätigungsmails in kurzer Zeit. Bitte warte ein paar Minuten.";
    }
    if (lower.includes("invalid login credentials") || lower.includes("wrong credentials")) {
      return "Anmeldung fehlgeschlagen. Bitte prüfe E-Mail und Passwort.";
    }
    if (lower.includes("already registered") || lower.includes("already been registered") || lower.includes("user already")) {
      return "Diese E-Mail ist bereits registriert. Bitte melde dich an oder sende die Bestätigung erneut.";
    }
    if (lower.includes("email not confirmed") || lower.includes("not confirmed")) {
      return "E-Mail noch nicht bestätigt. Bitte bestätige die E-Mail oder sende sie erneut.";
    }
    if (lower.includes("is invalid") || lower.includes("email address")) {
      return "Bitte verwende eine echte, gültige E-Mail-Adresse.";
    }
    return text || "Authentifizierung fehlgeschlagen.";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
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

      const result = isSignUp
        ? await signUpWithEmail(email, password)
        : await signInWithEmail(email, password);

      if (result.session) {
        onAuthSuccess(result);
      } else if (isSignUp) {
        setInfo("Konto erstellt. Bitte bestätige zuerst deine E-Mail und melde dich danach an.");
      }
    } catch (err) {
      const friendly = getFriendlyAuthError(err.message);
      const lower = String(err?.message || "").toLowerCase();
      setError(friendly);
      if (
        lower.includes("already registered") ||
        lower.includes("already been registered") ||
        lower.includes("email not confirmed") ||
        lower.includes("not confirmed") ||
        lower.includes("invalid login credentials")
      ) {
        setShowResendConfirm(true);
        setIsSignUp(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setInfo(null);

    if (!email) {
      setError("Bitte gib zuerst deine E-Mail-Adresse ein.");
      return;
    }

    setLoading(true);
    setInfo("Reset-Link wird gesendet...");
    try {
      await requestPasswordReset(email);
      setInfo("Passwort-Reset gesendet. Bitte prüfe dein E-Mail-Postfach.");
    } catch (err) {
      setError(getFriendlyAuthError(err.message));
      setInfo(null);
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_24%)]" />
      <Card className="relative w-full max-w-md rounded-[1.8rem] border-slate-800 bg-slate-900/82 shadow-[var(--shadow-medium)] backdrop-blur-xl">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-[1.35rem] bg-primary/12 p-4 text-primary">
              <BookOpen className="h-7 w-7" />
            </div>
          </div>
          <CardTitle className="text-3xl text-white">
            {isSignUp ? "Konto erstellen" : "Anmelden"}
          </CardTitle>
          <p className="mt-2 text-sm text-slate-400">Studien- & Lernplan</p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-200">E-Mail</label>
              <Input
                type="email"
                placeholder="deine@email.de"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-[1rem] border-slate-700 bg-slate-800/90 text-white placeholder:text-slate-500"
                disabled={loading}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-200">Passwort</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-[1rem] border-slate-700 bg-slate-800/90 text-white placeholder:text-slate-500"
                disabled={loading}
              />
              {isSignUp ? <p className="text-xs text-slate-400">Mindestens 6 Zeichen</p> : null}
            </div>

            {error ? (
              <div className="rounded-[1rem] border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            {info ? (
              <div className="rounded-[1rem] border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                {info}
              </div>
            ) : null}

            {showResendConfirm ? (
              <button
                type="button"
                onClick={handleResendConfirmation}
                className="text-left text-xs text-slate-200 underline underline-offset-4 hover:text-white"
                disabled={loading}
              >
                Bestätigungs-E-Mail erneut senden
              </button>
            ) : null}

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-[1rem] bg-primary hover:bg-primary/90"
            >
              {loading ? "Wird verarbeitet..." : isSignUp ? "Konto erstellen" : "Anmelden"}
            </Button>

            {!isSignUp ? (
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-left text-xs text-slate-200 underline underline-offset-4 hover:text-white"
                disabled={loading}
              >
                {loading ? "Reset-Link wird gesendet..." : "Passwort vergessen?"}
              </button>
            ) : null}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-slate-900/50 px-2 text-slate-400">oder</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="h-11 w-full rounded-[1rem] border border-slate-600 bg-slate-800 text-slate-100 font-medium transition-colors hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-500"
              disabled={loading}
            >
              {isSignUp ? "Bereits ein Konto? Anmelden" : "Neues Konto erstellen"}
            </button>

            <p className="mt-2 text-center text-xs text-slate-500">
              Verwende für die Registrierung eine echte E-Mail-Adresse.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
