"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      icons={{
        success: <CircleCheckIcon className="size-5" />,
        info: <InfoIcon className="size-5" />,
        warning: <TriangleAlertIcon className="size-5" />,
        error: <OctagonXIcon className="size-5" />,
        loading: <Loader2Icon className="size-5 animate-spin" />,
      }}
      offset="56px"
      toastOptions={{
        style: {
          padding: "20px 24px",
          fontSize: "15px",
          gap: "12px",
          borderRadius: "var(--radius)",
          minWidth: "380px",
        },
        classNames: {
          toast:
            "!bg-card !text-foreground !border !border-primary/20 !shadow-[0_4px_24px_oklch(0.63_0.23_345/0.15)]",
          success:
            "!bg-[oklch(0.18_0.04_150)] !text-[oklch(0.85_0.15_150)] !border-[oklch(0.45_0.12_150/0.4)]",
          error:
            "!bg-[oklch(0.18_0.06_25)] !text-[oklch(0.85_0.12_25)] !border-[oklch(0.55_0.2_25/0.4)]",
          description: "!text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
