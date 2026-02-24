"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  {
    q: "How does Lovable work?",
    a: "Simply describe the website you want to build using natural language. Our AI analyzes your prompt and generates a fully functional website with clean code, responsive design, and modern styling.",
  },
  {
    q: "Do I need coding experience?",
    a: "Not at all! Lovable is designed for everyone. Whether you're a designer, entrepreneur, or developer — just describe what you need and we handle the rest.",
  },
  {
    q: "Can I customize the generated website?",
    a: "Absolutely. You can iterate on your design by giving follow-up prompts, or dive into the code directly if you prefer hands-on control.",
  },
  {
    q: "What technologies are used in the generated sites?",
    a: "We generate modern websites using React, TypeScript, and Tailwind CSS — industry-standard tools that ensure performance, accessibility, and maintainability.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes! You can start building for free with generous daily credits. Upgrade anytime for more capacity and premium features.",
  },
];

export function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 px-4 bg-surface-dark">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-muted-foreground">
            Got questions? We&apos;ve got answers.
          </p>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <span className="text-sm font-medium text-foreground">
                  {faq.q}
                </span>
                <motion.span
                  animate={{ rotate: open === i ? 45 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-muted-foreground text-lg flex-shrink-0 ml-4"
                >
                  +
                </motion.span>
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
