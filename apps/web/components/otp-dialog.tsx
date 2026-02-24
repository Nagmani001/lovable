"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogClose } from "@repo/ui/components/dialog";
import { OtpInput } from "@repo/ui/components/input-otp";
import { Button } from "@repo/ui/components/button";
import { X } from "lucide-react";

interface OtpDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  onSubmit: (otp: string) => void;
  onResend: () => void;
  isLoading?: boolean;
}

export function OtpDialog({
  isOpen,
  onOpenChange,
  email,
  onSubmit,
  onResend,
  isLoading = false,
}: OtpDialogProps) {
  const [otp, setOtp] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length === 6) {
      onSubmit(otp);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="auth-card rounded-2xl p-8 max-w-md border-none">
        <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 transition-opacity outline-none">
          <X className="size-4 text-muted-foreground" />
          <span className="sr-only">Close</span>
        </DialogClose>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-foreground">
              Verify your email
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Enter the 6-digit code sent to{" "}
              <span className="text-foreground font-medium">{email}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <OtpInput value={otp} onChange={setOtp} disabled={isLoading} />

            <Button
              type="submit"
              disabled={otp.length !== 6 || isLoading}
              className="w-full py-3 h-auto rounded-xl font-semibold text-sm"
            >
              {isLoading ? "Verifying..." : "Verify Email"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-4">
            Didn&apos;t receive a code?{" "}
            <button
              type="button"
              onClick={onResend}
              disabled={isLoading}
              className="text-primary hover:underline disabled:opacity-50"
            >
              Resend
            </button>
          </p>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
