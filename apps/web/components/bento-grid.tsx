"use client";

import { motion } from "framer-motion";

export function BentoGrid() {
  return (
    <section id="features" className="py-24 px-4 bg-surface-dark">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-semibold text-foreground mb-4 tracking-tight">
            Everything you need
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto font-normal">
            Powerful features that make website creation effortless
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 auto-rows-auto">
          {/* Card 1 - AI Generation - LARGE (spans 2 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bento-glow group rounded-2xl border border-border bg-card p-8 overflow-hidden relative md:col-span-2 md:row-span-2"
          >
            <div className="mb-6 w-full max-w-[200px] h-[200px] mx-auto relative">
              <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
                {/* Input layer */}
                <circle
                  cx="30"
                  cy="40"
                  r="6"
                  className="fill-muted-foreground/20 group-hover:fill-primary transition-colors duration-300"
                />
                <circle
                  cx="30"
                  cy="80"
                  r="6"
                  className="fill-muted-foreground/20 group-hover:fill-primary transition-colors duration-500"
                />
                <circle
                  cx="30"
                  cy="120"
                  r="6"
                  className="fill-muted-foreground/20 group-hover:fill-primary transition-colors duration-400"
                />
                <circle
                  cx="30"
                  cy="160"
                  r="6"
                  className="fill-muted-foreground/20 group-hover:fill-primary transition-colors duration-600"
                />
                {/* Hidden layer 1 */}
                <circle
                  cx="80"
                  cy="55"
                  r="6"
                  className="fill-muted-foreground/20 group-hover:fill-[#fa94ea] transition-colors duration-500"
                />
                <circle
                  cx="80"
                  cy="100"
                  r="6"
                  className="fill-muted-foreground/20 group-hover:fill-[#fa94ea] transition-colors duration-700"
                />
                <circle
                  cx="80"
                  cy="145"
                  r="6"
                  className="fill-muted-foreground/20 group-hover:fill-[#fa94ea] transition-colors duration-600"
                />
                {/* Hidden layer 2 */}
                <circle
                  cx="130"
                  cy="70"
                  r="6"
                  className="fill-muted-foreground/20 group-hover:fill-[#d895f5] transition-colors duration-600"
                />
                <circle
                  cx="130"
                  cy="130"
                  r="6"
                  className="fill-muted-foreground/20 group-hover:fill-[#d895f5] transition-colors duration-800"
                />
                {/* Output */}
                <circle
                  cx="175"
                  cy="100"
                  r="8"
                  className="fill-muted-foreground/20 group-hover:fill-[#fc3851] transition-colors duration-700"
                />
                {/* Connections - input to hidden1 */}
                <line
                  x1="36"
                  y1="40"
                  x2="74"
                  y2="55"
                  className="stroke-muted-foreground/10 group-hover:stroke-primary/40 transition-all duration-500"
                  strokeWidth="1"
                />
                <line
                  x1="36"
                  y1="40"
                  x2="74"
                  y2="100"
                  className="stroke-muted-foreground/10 group-hover:stroke-primary/30 transition-all duration-600"
                  strokeWidth="1"
                />
                <line
                  x1="36"
                  y1="80"
                  x2="74"
                  y2="55"
                  className="stroke-muted-foreground/10 group-hover:stroke-primary/30 transition-all duration-400"
                  strokeWidth="1"
                />
                <line
                  x1="36"
                  y1="80"
                  x2="74"
                  y2="100"
                  className="stroke-muted-foreground/10 group-hover:stroke-primary/40 transition-all duration-500"
                  strokeWidth="1"
                />
                <line
                  x1="36"
                  y1="80"
                  x2="74"
                  y2="145"
                  className="stroke-muted-foreground/10 group-hover:stroke-primary/30 transition-all duration-600"
                  strokeWidth="1"
                />
                <line
                  x1="36"
                  y1="120"
                  x2="74"
                  y2="100"
                  className="stroke-muted-foreground/10 group-hover:stroke-primary/30 transition-all duration-500"
                  strokeWidth="1"
                />
                <line
                  x1="36"
                  y1="120"
                  x2="74"
                  y2="145"
                  className="stroke-muted-foreground/10 group-hover:stroke-primary/40 transition-all duration-400"
                  strokeWidth="1"
                />
                <line
                  x1="36"
                  y1="160"
                  x2="74"
                  y2="145"
                  className="stroke-muted-foreground/10 group-hover:stroke-primary/30 transition-all duration-600"
                  strokeWidth="1"
                />
                <line
                  x1="36"
                  y1="160"
                  x2="74"
                  y2="100"
                  className="stroke-muted-foreground/10 group-hover:stroke-primary/20 transition-all duration-700"
                  strokeWidth="1"
                />
                {/* hidden1 to hidden2 */}
                <line
                  x1="86"
                  y1="55"
                  x2="124"
                  y2="70"
                  className="stroke-muted-foreground/10 group-hover:stroke-[#fa94ea]/40 transition-all duration-500"
                  strokeWidth="1"
                />
                <line
                  x1="86"
                  y1="55"
                  x2="124"
                  y2="130"
                  className="stroke-muted-foreground/10 group-hover:stroke-[#fa94ea]/20 transition-all duration-700"
                  strokeWidth="1"
                />
                <line
                  x1="86"
                  y1="100"
                  x2="124"
                  y2="70"
                  className="stroke-muted-foreground/10 group-hover:stroke-[#fa94ea]/30 transition-all duration-600"
                  strokeWidth="1"
                />
                <line
                  x1="86"
                  y1="100"
                  x2="124"
                  y2="130"
                  className="stroke-muted-foreground/10 group-hover:stroke-[#fa94ea]/30 transition-all duration-500"
                  strokeWidth="1"
                />
                <line
                  x1="86"
                  y1="145"
                  x2="124"
                  y2="130"
                  className="stroke-muted-foreground/10 group-hover:stroke-[#fa94ea]/40 transition-all duration-600"
                  strokeWidth="1"
                />
                <line
                  x1="86"
                  y1="145"
                  x2="124"
                  y2="70"
                  className="stroke-muted-foreground/10 group-hover:stroke-[#fa94ea]/20 transition-all duration-800"
                  strokeWidth="1"
                />
                {/* hidden2 to output */}
                <line
                  x1="136"
                  y1="70"
                  x2="167"
                  y2="100"
                  className="stroke-muted-foreground/10 group-hover:stroke-[#d895f5]/50 transition-all duration-600"
                  strokeWidth="1.5"
                />
                <line
                  x1="136"
                  y1="130"
                  x2="167"
                  y2="100"
                  className="stroke-muted-foreground/10 group-hover:stroke-[#d895f5]/50 transition-all duration-700"
                  strokeWidth="1.5"
                />
                {/* Pulse on output */}
                <circle
                  cx="175"
                  cy="100"
                  r="12"
                  className="stroke-muted-foreground/0 group-hover:stroke-[#fc3851]/20"
                  strokeWidth="1"
                  fill="none"
                >
                  <animate
                    attributeName="r"
                    values="12;20;12"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.3;0;0.3"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>
                <circle
                  cx="175"
                  cy="100"
                  r="16"
                  className="stroke-muted-foreground/0 group-hover:stroke-[#fc3851]/10"
                  strokeWidth="1"
                  fill="none"
                >
                  <animate
                    attributeName="r"
                    values="16;26;16"
                    dur="2s"
                    repeatCount="indefinite"
                    begin="0.5s"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.2;0;0.2"
                    dur="2s"
                    repeatCount="indefinite"
                    begin="0.5s"
                  />
                </circle>
              </svg>
            </div>
            <h3 className="text-xl font-medium text-foreground mb-2">
              AI-Powered Generation
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed font-normal max-w-md">
              Describe your website in plain English and watch it come to life.
              Our neural engine understands context, layout, and design intent —
              no code required.
            </p>
          </motion.div>

          {/* Card 2 - Live Preview - Small */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bento-glow group rounded-2xl border border-border bg-card p-7 overflow-hidden relative"
          >
            <div className="mb-5 w-16 h-16 relative">
              <svg viewBox="0 0 64 64" fill="none" className="w-full h-full">
                <rect
                  x="8"
                  y="8"
                  width="48"
                  height="36"
                  rx="4"
                  className="stroke-muted-foreground/30 group-hover:stroke-[#d895f5]/70 transition-colors duration-500"
                  strokeWidth="2"
                  fill="none"
                />
                <line
                  x1="26"
                  y1="44"
                  x2="38"
                  y2="44"
                  className="stroke-muted-foreground/30 group-hover:stroke-[#d895f5]/50 transition-colors duration-500"
                  strokeWidth="2"
                />
                <line
                  x1="32"
                  y1="44"
                  x2="32"
                  y2="52"
                  className="stroke-muted-foreground/30 group-hover:stroke-[#d895f5]/50 transition-colors duration-500"
                  strokeWidth="2"
                />
                <line
                  x1="24"
                  y1="52"
                  x2="40"
                  y2="52"
                  className="stroke-muted-foreground/30 group-hover:stroke-[#d895f5]/50 transition-colors duration-500"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <polyline
                  points="14,26 20,26 23,18 26,34 29,22 32,30 35,24 38,26 44,26 50,26"
                  className="stroke-muted-foreground/20 group-hover:stroke-[#d895f5] transition-colors duration-500"
                  strokeWidth="1.8"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <animate
                    attributeName="stroke-dasharray"
                    values="0,200;100,200;0,200"
                    dur="3s"
                    repeatCount="indefinite"
                  />
                </polyline>
                <circle
                  cx="48"
                  cy="14"
                  r="2.5"
                  className="fill-muted-foreground/20 group-hover:fill-[#fc3851] transition-colors duration-300"
                >
                  <animate
                    attributeName="opacity"
                    values="1;0.3;1"
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                </circle>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Real-time Preview
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed font-normal">
              See changes as you type with instant hot-reload.
            </p>
          </motion.div>

          {/* Card 3 - Smart Components - Small */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bento-glow group rounded-2xl border border-border bg-card p-7 overflow-hidden relative"
          >
            <div className="mb-5 w-16 h-16 relative">
              <svg viewBox="0 0 64 64" fill="none" className="w-full h-full">
                <rect
                  x="8"
                  y="8"
                  width="20"
                  height="20"
                  rx="4"
                  className="fill-muted-foreground/10 stroke-muted-foreground/25 group-hover:fill-[#406fd0]/20 group-hover:stroke-[#406fd0]/60 transition-all duration-300"
                  strokeWidth="1.5"
                >
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0,0;2,-2;0,0"
                    dur="4s"
                    repeatCount="indefinite"
                  />
                </rect>
                <rect
                  x="36"
                  y="8"
                  width="20"
                  height="20"
                  rx="4"
                  className="fill-muted-foreground/10 stroke-muted-foreground/25 group-hover:fill-primary/20 group-hover:stroke-primary/60 transition-all duration-500"
                  strokeWidth="1.5"
                >
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0,0;-2,-1;0,0"
                    dur="4s"
                    repeatCount="indefinite"
                    begin="0.5s"
                  />
                </rect>
                <rect
                  x="8"
                  y="36"
                  width="20"
                  height="20"
                  rx="4"
                  className="fill-muted-foreground/10 stroke-muted-foreground/25 group-hover:fill-[#fa94ea]/20 group-hover:stroke-[#fa94ea]/60 transition-all duration-400"
                  strokeWidth="1.5"
                >
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0,0;1,2;0,0"
                    dur="4s"
                    repeatCount="indefinite"
                    begin="1s"
                  />
                </rect>
                <rect
                  x="36"
                  y="36"
                  width="20"
                  height="20"
                  rx="4"
                  className="fill-muted-foreground/10 stroke-muted-foreground/25 group-hover:fill-[#d895f5]/20 group-hover:stroke-[#d895f5]/60 transition-all duration-600"
                  strokeWidth="1.5"
                >
                  <animateTransform
                    attributeName="transform"
                    type="translate"
                    values="0,0;-1,1;0,0"
                    dur="4s"
                    repeatCount="indefinite"
                    begin="1.5s"
                  />
                </rect>
                <circle
                  cx="32"
                  cy="32"
                  r="3"
                  className="fill-muted-foreground/10 group-hover:fill-foreground/40 transition-colors duration-500"
                >
                  <animate
                    attributeName="r"
                    values="3;4;3"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Smart Components
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed font-normal">
              Intelligent suggestions based on your content and style.
            </p>
          </motion.div>

          {/* Card 4 - Deploy - WIDE (spans 3 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bento-glow group rounded-2xl border border-border bg-card p-8 overflow-hidden relative md:col-span-3"
          >
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="w-24 h-24 relative shrink-0">
                <svg viewBox="0 0 96 96" fill="none" className="w-full h-full">
                  <g className="group-hover:-translate-y-2 transition-transform duration-700">
                    <path
                      d="M48 8 C48 8, 30 28, 30 52 L38 58 L58 58 L66 52 C66 28, 48 8, 48 8Z"
                      className="fill-muted-foreground/15 stroke-muted-foreground/30 group-hover:fill-[#fc3851]/20 group-hover:stroke-[#fc3851]/70 transition-all duration-500"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx="48"
                      cy="36"
                      r="6"
                      className="fill-muted-foreground/10 stroke-muted-foreground/25 group-hover:fill-[#406fd0]/30 group-hover:stroke-[#406fd0]/60 transition-all duration-500"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M30 48 L20 62 L30 58Z"
                      className="fill-muted-foreground/15 group-hover:fill-[#fa94ea]/30 transition-colors duration-500"
                    />
                    <path
                      d="M66 48 L76 62 L66 58Z"
                      className="fill-muted-foreground/15 group-hover:fill-[#fa94ea]/30 transition-colors duration-500"
                    />
                  </g>
                  {/* Flame */}
                  <circle
                    cx="45"
                    cy="66"
                    r="3"
                    className="fill-muted-foreground/0 group-hover:fill-[#fc3851]/60 transition-colors duration-300"
                  >
                    <animate
                      attributeName="cy"
                      values="66;78;66"
                      dur="0.8s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.8;0;0.8"
                      dur="0.8s"
                      repeatCount="indefinite"
                    />
                  </circle>
                  <circle
                    cx="51"
                    cy="68"
                    r="2"
                    className="fill-muted-foreground/0 group-hover:fill-[#fa94ea]/60 transition-colors duration-300"
                  >
                    <animate
                      attributeName="cy"
                      values="68;80;68"
                      dur="1s"
                      repeatCount="indefinite"
                      begin="0.2s"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.6;0;0.6"
                      dur="1s"
                      repeatCount="indefinite"
                      begin="0.2s"
                    />
                  </circle>
                  <circle
                    cx="48"
                    cy="64"
                    r="3.5"
                    className="fill-muted-foreground/0 group-hover:fill-[#fc3851]/40 transition-colors duration-300"
                  >
                    <animate
                      attributeName="cy"
                      values="64;76;64"
                      dur="0.6s"
                      repeatCount="indefinite"
                      begin="0.4s"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.7;0;0.7"
                      dur="0.6s"
                      repeatCount="indefinite"
                      begin="0.4s"
                    />
                  </circle>
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-medium text-foreground mb-2">
                  Deploy Instantly
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed font-normal max-w-lg">
                  One-click deployment to production. Your site goes live in
                  seconds with automatic SSL, CDN, and global edge distribution.
                  Share your creation with the world.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
