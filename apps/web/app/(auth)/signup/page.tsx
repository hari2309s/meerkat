"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@meerkat/ui";
import { Input } from "@meerkat/ui";
import { Label } from "@meerkat/ui";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Mail, Lock, User, CheckCircle, Smile } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [sentToEmail, setSentToEmail] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    preferredName: "",
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.name,
            // preferred_name is used for greetings — falls back to full_name if blank
            preferred_name: formData.preferredName.trim() || formData.name,
          },
          // Points to /auth/confirm which handles the token_hash Supabase sends
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/`,
        },
      });

      if (signUpError) throw signUpError;

      if (data.user) {
        if (data.user.identities?.length === 0) {
          setError(
            "An account with this email already exists. Try signing in instead.",
          );
          return;
        }

        // Email confirmation required (Supabase default)
        if (!data.session) {
          setSentToEmail(formData.email);
          setEmailSent(true);
          return;
        }

        // Email confirmation disabled in Supabase dashboard — go straight in
        router.push("/");
        router.refresh();
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes("Password should be")) {
          setError("Password must be at least 6 characters.");
        } else if (err.message.includes("already registered")) {
          setError(
            "An account with this email already exists. Try signing in instead.",
          );
        } else {
          setError(err.message);
        }
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <AuthLayout
        title="Check your inbox"
        subtitle="One last step to get you in"
      >
        <div className="space-y-6 text-center">
          <div className="flex justify-center">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <div className="space-y-2">
            <p className="text-meerkat-dark font-medium">
              We&apos;ve sent a confirmation link to:
            </p>
            <p className="text-meerkat-brown font-semibold break-all">
              {sentToEmail}
            </p>
          </div>
          <p className="text-sm text-meerkat-brown/80">
            Click the link in the email to activate your account. Check your
            spam folder if you don&apos;t see it within a minute.
          </p>
          <div className="pt-2">
            <Link href="/login">
              <Button variant="outline" className="w-full" type="button">
                Back to sign in
              </Button>
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Join the mob"
      subtitle="Create your account and start collaborating"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
          <Label htmlFor="name">Full Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-meerkat-brown/50" />
            <Input
              id="name"
              type="text"
              placeholder="Meera Kat"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="pl-11"
              required
              disabled={isLoading}
              autoComplete="name"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="preferredName">Preferred Name</Label>
            <span className="text-xs text-meerkat-brown/50">(optional)</span>
          </div>
          <div className="relative">
            <Smile className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-meerkat-brown/50" />
            <Input
              id="preferredName"
              type="text"
              placeholder="What should we call you?"
              value={formData.preferredName}
              onChange={(e) =>
                setFormData({ ...formData, preferredName: e.target.value })
              }
              className="pl-11"
              disabled={isLoading}
              autoComplete="nickname"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-meerkat-brown/50" />
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="pl-11"
              required
              disabled={isLoading}
              autoComplete="email"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-meerkat-brown/50" />
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="pl-11"
              required
              minLength={6}
              disabled={isLoading}
              autoComplete="new-password"
            />
          </div>
          <p className="text-xs text-meerkat-brown/70">At least 6 characters</p>
        </div>

        <Button
          type="submit"
          className="w-full h-12 text-base font-semibold"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Creating your burrow...
            </>
          ) : (
            "Create account"
          )}
        </Button>

        <div className="relative mt-3">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-meerkat-tan/40" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span
              className="px-3 text-meerkat-brown/70"
              style={{ background: "rgba(255,248,240,0.6)" }}
            >
              Already have an account?
            </span>
          </div>
        </div>

        <div className="mt-4">
          <Link href="/login">
            <Button
              variant="outline"
              className="w-full font-medium"
              type="button"
            >
              Sign in instead
            </Button>
          </Link>
        </div>
      </form>

      <p className="mt-4 text-center text-xs text-meerkat-brown/60">
        By creating an account, you agree to our{" "}
        <Link href="/terms" className="underline hover:text-meerkat-dark">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-meerkat-dark">
          Privacy Policy
        </Link>
      </p>
    </AuthLayout>
  );
}
