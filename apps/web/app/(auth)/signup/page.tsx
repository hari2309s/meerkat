"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@meerkat/ui";
import { Input } from "@meerkat/ui";
import { Label } from "@meerkat/ui";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Mail, Lock, User } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Sign up with Supabase
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      if (data.user) {
        // Check if email confirmation is required
        if (data.user.identities?.length === 0) {
          setError("An account with this email already exists");
          setIsLoading(false);
          return;
        }

        // Redirect to workspace or email confirmation message
        router.push("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign up");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Join the mob"
      subtitle="Create your account and start collaborating"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border-2 border-red-200 text-red-800 rounded-xl p-4 text-sm"
          >
            {error}
          </motion.div>
        )}

        {/* Name field */}
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
            />
          </div>
        </div>

        {/* Email field */}
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
            />
          </div>
        </div>

        {/* Password field */}
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
            />
          </div>
          <p className="text-xs text-meerkat-brown/70">At least 6 characters</p>
        </div>

        {/* Submit button */}
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
            <>
              <span className="mr-2">🦦</span>
              Create account
            </>
          )}
        </Button>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t-2 border-meerkat-tan/30" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-4 text-meerkat-brown">
              Already have an account?
            </span>
          </div>
        </div>

        {/* Sign in link */}
        <div className="text-center">
          <Link href="/login">
            <Button variant="ghost" className="text-meerkat-brown hover:text-meerkat-dark font-medium">
              Sign in instead
            </Button>
          </Link>
        </div>
      </form>

      {/* Terms and privacy */}
      <p className="mt-8 text-center text-xs text-meerkat-brown/70">
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
