"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";

const prompts = [
  "Build me a portfolio website with dark theme...",
  "Create an e-commerce store with product grid...",
  "Design a SaaS dashboard with analytics...",
];

const steps = [
  {
    title: "Start with an idea",
    description:
      "Describe the app or website you want to create or drop in screenshots and docs",
  },
  {
    title: "Watch it come to life",
    description:
      "See your vision transform into a working prototype in real-time as AI builds it for you",
  },
  {
    title: "Refine and ship",
    description:
      "Iterate on your creation with simple feedback and deploy to the world with one click",
  },
];

export function ProductShowcase() {
  const [currentPrompt, setCurrentPrompt] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const prompt = prompts[currentPrompt]!;
    let charIndex = 0;
    setTypedText("");
    setIsSending(false);

    const typeInterval = setInterval(() => {
      if (charIndex < prompt.length) {
        setTypedText(prompt.slice(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(typeInterval);
        setTimeout(() => {
          setIsSending(true);
          setTimeout(() => {
            setCurrentPrompt((prev) => (prev + 1) % prompts.length);
          }, 1500);
        }, 600);
      }
    }, 50);

    return () => clearInterval(typeInterval);
  }, [currentPrompt]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-32 px-4 bg-surface-dark">
      <div className="max-w-5xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl md:text-5xl font-semibold text-foreground mb-16 tracking-tight"
        >
          How it works
        </motion.h2>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-stretch">
          {/* Left - Animated prompt input demo (3/5 width) */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-3 rounded-2xl bg-card border border-border p-10 min-h-[560px] flex flex-col justify-center relative overflow-hidden"
          >
            {/* Decorative gradient orb */}
            <div
              className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-25 blur-[100px] pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, #fc3851 0%, #fa94ea50 50%, transparent 100%)",
              }}
            />
            <div
              className="absolute bottom-0 left-0 w-full h-1/2 opacity-15 pointer-events-none"
              style={{
                background:
                  "linear-gradient(to top, #fc385130 0%, transparent 100%)",
              }}
            />

            <div className="relative z-10">
              <p className="text-xs text-muted-foreground mb-4 font-medium tracking-wide uppercase">
                Prompt
              </p>

              {/* Input area */}
              <div className="rounded-xl bg-input-dark border border-border p-4 mb-4">
                <p className="text-sm text-foreground min-h-[48px] leading-relaxed">
                  {typedText}
                  <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse align-middle" />
                </p>
              </div>

              {/* Send animation */}
              <motion.div
                animate={
                  isSending
                    ? { y: -20, opacity: 0, scale: 0.95 }
                    : { y: 0, opacity: 1, scale: 1 }
                }
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="text-muted-foreground"
                    >
                      <path
                        d="M8 3v10M3 8h10"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="text-muted-foreground"
                    >
                      <rect
                        x="2"
                        y="3"
                        width="12"
                        height="10"
                        rx="2"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <circle cx="5.5" cy="6.5" r="1" fill="currentColor" />
                      <path
                        d="M2 10l3-2.5L8 10l3-4 3 3"
                        stroke="currentColor"
                        strokeWidth="1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M7 12V2M7 2L3 6M7 2l4 4"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </motion.div>

              {/* Generating indicator */}
              {isSending && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 mt-4"
                >
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-primary"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: i * 0.2,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Generating...
                  </span>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Right - Feature steps (2/5 width) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-2 flex flex-col gap-12 justify-center py-8"
          >
            {steps.map((step, index) => (
              <motion.div
                key={index}
                animate={{
                  opacity: activeStep === index ? 1 : 0.4,
                }}
                transition={{ duration: 0.5 }}
                className="relative"
              >
                <h3
                  className={`text-2xl md:text-3xl font-semibold mb-2 transition-colors duration-500 ${
                    activeStep === index
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-md font-normal">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
