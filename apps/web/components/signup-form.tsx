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
import { OtpDialog } from "@/components/otp-dialog";
import { useRouter } from "next/navigation";

interface SignupInputs {
  name: string;
  email: string;
  password: string;
}
export function SignUpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpOpen, setOtpOpen] = useState(false);
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: async (signupInputs: SignupInputs) => {
      const res = await authClient.signUp.email({
        email: signupInputs.email,
        name: signupInputs.name,
        password: signupInputs.password,
      });
      if (res.error) {
        toast.error(res.error.message);
      } else {
        const { data, error } = await authClient.emailOtp.sendVerificationOtp({
          email,
          type: "email-verification",
        });
        if (error) {
          toast.error(error.message);
        } else {
          toast.success("Verification code sent to your email");
          setOtpOpen(true);
        }
      }
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (otp: string) => {
      const res = await authClient.emailOtp.verifyEmail({
        email,
        otp,
      });
      if (res.error) {
        toast.error(res.error.message);
      } else {
        toast.success("Email verified successfully!");
        setOtpOpen(false);
        router.push("/signin");
      }
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  async function handleResendOtp() {
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Verification code resent");
    }
  }

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
        <h1 className="text-2xl font-bold text-foreground">
          Create your account
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Start building websites with AI
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate({
            name,
            email,
            password,
          });
        }}
        className="space-y-4"
      >
        <div>
          <Label className="text-sm text-muted-foreground mb-1.5">
            Full Name
          </Label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 h-auto rounded-xl bg-secondary border-border text-sm"
            placeholder="John Doe"
          />
        </div>
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
          Create Account
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground mt-6">
        Already have an account?{" "}
        <Link href="/signin" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>

      <OtpDialog
        isOpen={otpOpen}
        onOpenChange={setOtpOpen}
        email={email}
        onSubmit={(otp) => verifyMutation.mutate(otp)}
        onResend={handleResendOtp}
        isLoading={verifyMutation.isPending}
      />
    </motion.div>
  );
}
