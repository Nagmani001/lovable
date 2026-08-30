"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background gradient covering bottom 60% */}
      <div
        className="absolute inset-0 pointer-events-none dark:opacity-45 opacity-25"
        style={{
          background:
            "linear-gradient(to top, #fc3851 0%, #fa94ea 20%, #d895f5 35%, #406fd0 50%, transparent 60%)",
        }}
      />
      {/* Extra glow bloom */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[120%] h-[50%] pointer-events-none dark:opacity-100 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 70% 80% at 50% 100%, #fc385180 0%, #fa94ea40 30%, #d895f530 50%, transparent 70%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-secondary/50 text-xs text-muted-foreground mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
            Now in public beta
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
          className="text-5xl md:text-7xl font-semibold tracking-tighter text-foreground leading-[1.1] mb-6"
        >
          Build websites with a single prompt
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed font-normal"
        >
          Describe your vision, and our AI turns it into a fully functional
          website in seconds. No code, no templates — just your imagination.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="flex items-center justify-center"
        >
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2 px-8 py-3.5 bg-primary text-primary-foreground rounded-xl font-medium text-base hover:opacity-90 transition-all hover:shadow-[0_0_30px_oklch(0.63_0.23_345/0.3)]"
          >
            Start Building Free
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="transition-transform duration-300 group-hover:translate-x-1"
            >
              <path
                d="M3 8h10M9 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
