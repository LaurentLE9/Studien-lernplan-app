import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signUpWithEmail, signInWithEmail } from "@/lib/cloudStore";
import { BookOpen } from "lucide-react";

export default function AuthScreen({ onAuthSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
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
      setError(err.message || "Authentication failed");
      console.error("Auth error:", err);
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

            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg h-10 bg-primary hover:bg-primary/90"
            >
              {loading ? "Loading..." : isSignUp ? "Create Account" : "Sign In"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-slate-900/50 text-slate-400">or</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="w-full rounded-lg border-slate-600 text-slate-200 hover:bg-slate-800"
              disabled={loading}
            >
              {isSignUp ? "Already have an account? Sign In" : "Create new account"}
            </Button>

            <p className="text-xs text-slate-500 text-center mt-2">
              Demo mode: Use test@example.com / password123
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
