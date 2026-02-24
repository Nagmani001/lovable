"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { LovableLogo } from "@repo/ui/components/lovable-logo";
import { useMutation } from "@tanstack/react-query";
import { authClient } from "@/lib/auth";
import { toast } from "@repo/ui/lib/toast";
import { useRouter } from "next/navigation";

interface SigninInputs {
  email: string;
  password: string;
}

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: async (signinInputs: SigninInputs) => {
      const res = await authClient.signIn.email({
        email: signinInputs.email,
        password: signinInputs.password,
      });
      if (res.error) {
        toast.error(res.error.message);
      } else {
        router.push("/projects");
      }
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="auth-card rounded-2xl p-8 w-full max-w-md relative z-10"
    >
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2 mb-6">
          <LovableLogo size={32} />
          <span className="text-lg font-bold text-foreground">Lovable</span>
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sign in to continue building
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate({
            email,
            password,
          });
        }}
        className="space-y-4"
      >
        <div>
          <Label className="text-sm text-muted-foreground mb-1.5">Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 h-auto rounded-xl bg-secondary border-border text-sm"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <Label className="text-sm text-muted-foreground mb-1.5">
            Password
          </Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 h-auto rounded-xl bg-secondary border-border text-sm"
            placeholder="••••••••"
          />
        </div>
        <Button
          type="submit"
          className="w-full py-3 h-auto rounded-xl font-semibold text-sm"
        >
          Sign In
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </motion.div>
  );
}
