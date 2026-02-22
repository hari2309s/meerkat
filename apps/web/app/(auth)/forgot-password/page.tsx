"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button, Input, Label } from "@meerkat/ui";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Mail, CheckCircle, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        },
      );

      if (resetError) throw resetError;

      setEmailSent(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <AuthLayout title="Check your inbox" subtitle="Password reset link sent">
        <div className="space-y-6 text-center">
          <div className="flex justify-center">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <div className="space-y-2">
            <p className="text-meerkat-dark font-medium">
              We&apos;ve sent a reset link to:
            </p>
            <p className="text-meerkat-brown font-semibold break-all">
              {email}
            </p>
          </div>
          <p className="text-sm text-meerkat-brown/80">
            Click the link in the email to set a new password. The link expires
            in 1 hour.
          </p>
          <Link href="/login">
            <Button variant="outline" className="w-full" type="button">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to sign in
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot password?"
      subtitle="Enter your email and we'll send you a reset link"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-meerkat-brown/50" />
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-11"
              required
              disabled={isLoading}
              autoComplete="email"
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full h-12 text-base font-semibold bg-meerkat-dark hover:bg-meerkat-dark/80"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Sending link...
            </>
          ) : (
            "Send reset link"
          )}
        </Button>

        <div className="text-center pt-2">
          <Link href="/login">
            <Button
              variant="ghost"
              className="text-meerkat-brown hover:text-meerkat-dark font-medium"
              type="button"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to sign in
            </Button>
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
