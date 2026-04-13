/**
 * Intent classifier for user messages.
 *
 * Uses a weighted keyword scoring approach — each intent has a set of
 * keyword patterns with scores. The intent with the highest total score wins.
 * Falls back to "question" when nothing matches strongly.
 */

export type Intent =
  | "ui_styling" //        "make the button blue", "fix the spacing"
  | "animation" //         "add a fade in", "loading skeleton"
  | "responsive_layout" // "broken on mobile", "fix tablet layout"
  | "new_feature" //       "add a sidebar", "create a settings page"
  | "bug_fix" //           "it's crashing", "I see an error"
  | "logic_state" //       "filter todos by date", "toggle dark mode"
  | "data_api" //          "fetch from this API", "connect to Supabase"
  | "navigation_routing" //"add a new page", "fix back button"
  | "refactor" //          "split this into smaller components"
  | "typescript_types" //  "add types to this", "fix type error"
  | "content_copy" //      "change the heading text", "update the footer"
  | "question"; //         "how does X work?", "what's the best way to…"

interface IntentRule {
  intent: Intent;
  patterns: Array<{ regex: RegExp; score: number }>;
}

const RULES: IntentRule[] = [
  // ─── content_copy ────────────────────────────────────────────────────────
  // Checked first because it's the most specific and smallest possible context.
  {
    intent: "content_copy",
    patterns: [
      {
        regex: /\bchange (the )?(heading|title|text|label|copy|wording)\b/i,
        score: 10,
      },
      {
        regex:
          /\bupdate (the )?(text|copy|footer|header|label|link|description)\b/i,
        score: 10,
      },
      {
        regex: /\bfix (the )?(label|text|copy|wording|typo|spelling)\b/i,
        score: 8,
      },
      {
        regex: /\brename (the )?(button|tab|link|label|menu item)\b/i,
        score: 8,
      },
      { regex: /\btypo\b/i, score: 6 },
    ],
  },

  // ─── ui_styling ──────────────────────────────────────────────────────────
  {
    intent: "ui_styling",
    patterns: [
      {
        regex:
          /\b(make|set|change|update) (it |the )?(color|colour|background|bg|border|shadow|opacity|font|text size|size|radius|padding|margin|gap|spacing)\b/i,
        score: 10,
      },
      {
        regex:
          /\b(blue|red|green|purple|pink|yellow|orange|white|black|gray|grey|dark|light|primary|secondary)\b/i,
        score: 4,
      },
      {
        regex:
          /\b(style|styling|styled|css|className|class name|tailwind|theme|palette|design)\b/i,
        score: 7,
      },
      {
        regex:
          /\b(button|icon|badge|chip|tag|card|avatar|tooltip|dropdown|input|select|checkbox|radio|toggle|switch|accordion)\b/i,
        score: 3,
      },
      {
        regex:
          /\bfix (the )?(spacing|padding|margin|gap|alignment|layout|positioning|overlap|overflow)\b/i,
        score: 8,
      },
      { regex: /\b(center|align|justify|flex|grid|column|row)\b/i, score: 3 },
      { regex: /\blook(s)? (bad|wrong|off|broken|ugly|weird)\b/i, score: 6 },
    ],
  },

  // ─── animation ───────────────────────────────────────────────────────────
  {
    intent: "animation",
    patterns: [
      {
        regex:
          /\b(animation|animate|transition|motion|keyframe|ease|spring|bounce|framer)\b/i,
        score: 10,
      },
      {
        regex:
          /\b(fade|slide|scale|rotate|flip|spin|pulse|blink|shake|wobble)\b/i,
        score: 9,
      },
      { regex: /\b(skeleton|loading state|shimmer|placeholder)\b/i, score: 8 },
      { regex: /\b(hover effect|on hover|when hover)\b/i, score: 7 },
      {
        regex:
          /\b(enter|exit|appear|disappear|mount|unmount) (animation|transition|effect)\b/i,
        score: 9,
      },
    ],
  },

  // ─── responsive_layout ───────────────────────────────────────────────────
  {
    intent: "responsive_layout",
    patterns: [
      {
        regex:
          /\b(mobile|tablet|desktop|screen|breakpoint|responsive|viewport)\b/i,
        score: 9,
      },
      {
        regex:
          /\b(broken on|looks bad on|fix on) (mobile|tablet|desktop|small|large|sm|md|lg|xl)\b/i,
        score: 12,
      },
      {
        regex: /\b(stack|stacked|columns|grid) on (small|mobile|narrow)\b/i,
        score: 10,
      },
      { regex: /\b(sm:|md:|lg:|xl:|2xl:)\b/i, score: 8 },
      {
        regex: /\b(overflow|scroll|wrap|truncate|ellipsis) (on|when|at)\b/i,
        score: 6,
      },
    ],
  },

  // ─── bug_fix ─────────────────────────────────────────────────────────────
  {
    intent: "bug_fix",
    patterns: [
      {
        regex:
          /\b(error|crash|exception|throw|thrown|fail|failed|failure|broken|broke|bug)\b/i,
        score: 10,
      },
      {
        regex:
          /\b(not working|doesn't work|won't work|can't|cannot|undefined|null|NaN|infinite loop)\b/i,
        score: 9,
      },
      {
        regex:
          /\b(console\.log|console\.error|stack trace|traceback|debugg?)\b/i,
        score: 8,
      },
      {
        regex:
          /\b(fix (this|it|the bug|the error|the issue|the problem)|it's (broken|crashing))\b/i,
        score: 9,
      },
      {
        regex:
          /\b(TypeError|ReferenceError|SyntaxError|RangeError|NetworkError)\b/i,
        score: 12,
      },
      { regex: /\b(404|500|503|CORS|timeout|401|403)\b/i, score: 7 },
    ],
  },

  // ─── data_api ────────────────────────────────────────────────────────────
  {
    intent: "data_api",
    patterns: [
      {
        regex:
          /\b(fetch|api|endpoint|http|axios|request|response|REST|GraphQL|webhook|call)\b/i,
        score: 10,
      },
      {
        regex:
          /\b(supabase|firebase|prisma|drizzle|mysql|postgres|mongodb|redis|database|db)\b/i,
        score: 10,
      },
      {
        regex: /\b(localStorage|sessionStorage|cookie|indexedDB|cache)\b/i,
        score: 9,
      },
      {
        regex:
          /\b(useQuery|useMutation|react-query|swr|tanstack|react query)\b/i,
        score: 9,
      },
      {
        regex:
          /\b(save|load|store|persist|sync|read|write) (to|from|in|data)\b/i,
        score: 6,
      },
      { regex: /\b(GET|POST|PUT|PATCH|DELETE) request\b/i, score: 8 },
    ],
  },

  // ─── navigation_routing ──────────────────────────────────────────────────
  {
    intent: "navigation_routing",
    patterns: [
      {
        regex:
          /\b(route|router|routing|navigate|navigation|redirect|link|href|path|url|slug)\b/i,
        score: 10,
      },
      {
        regex: /\b(new page|add (a )?page|create (a )?page|page not found)\b/i,
        score: 9,
      },
      {
        regex:
          /\b(back button|breadcrumb|navbar|sidebar|menu|nav link|tab navigation)\b/i,
        score: 7,
      },
      {
        regex:
          /\b(react-router|wouter|tanstack router|next\.js routing|app router)\b/i,
        score: 10,
      },
      { regex: /\b(404 page|not found page|catch-all route)\b/i, score: 9 },
    ],
  },

  // ─── new_feature ─────────────────────────────────────────────────────────
  {
    intent: "new_feature",
    patterns: [
      {
        regex:
          /\b(add|create|build|implement|make) (a |an )?(new )?(feature|component|page|section|panel|widget|modal|dialog|drawer|popover|sidebar|header|footer|form|table|chart|graph|carousel|gallery|timeline|stepper|wizard)\b/i,
        score: 10,
      },
      {
        regex: /\b(from scratch|new component|new section|new page)\b/i,
        score: 9,
      },
      {
        regex: /\b(integrate|add support for|add functionality|add ability)\b/i,
        score: 7,
      },
    ],
  },

  // ─── logic_state ─────────────────────────────────────────────────────────
  {
    intent: "logic_state",
    patterns: [
      {
        regex:
          /\b(state|useState|useReducer|zustand|jotai|redux|recoil|context|store)\b/i,
        score: 10,
      },
      {
        regex:
          /\b(filter|sort|search|toggle|increment|decrement|counter|select|deselect|check|uncheck)\b/i,
        score: 7,
      },
      {
        regex:
          /\b(logic|condition|if|when|computed|derived|selector|memo|useMemo|useCallback)\b/i,
        score: 6,
      },
      {
        regex:
          /\b(form (state|validation)|onSubmit|onChange|onBlur|controlled|uncontrolled)\b/i,
        score: 8,
      },
      {
        regex:
          /\b(dark mode|light mode|theme toggle|locale|i18n|language switch)\b/i,
        score: 8,
      },
    ],
  },

  // ─── refactor ────────────────────────────────────────────────────────────
  {
    intent: "refactor",
    patterns: [
      {
        regex:
          /\b(refactor|split|extract|decompose|break (out|down|up|apart)|separate|modularize|reorganize)\b/i,
        score: 10,
      },
      {
        regex:
          /\b(duplicate code|repeated code|DRY|abstract|generalize|reuse|shared)\b/i,
        score: 9,
      },
      {
        regex:
          /\b(clean up|cleanup|simplify|remove (dead|unused|old)|delete (dead|unused|old))\b/i,
        score: 7,
      },
      {
        regex:
          /\b(rename (this|the (function|component|variable|file|class|hook)))\b/i,
        score: 8,
      },
      {
        regex: /\b(into smaller|into (a )?separate|into (a )?component)\b/i,
        score: 9,
      },
    ],
  },

  // ─── typescript_types ────────────────────────────────────────────────────
  {
    intent: "typescript_types",
    patterns: [
      {
        regex:
          /\b(TypeScript|typescript|ts|type error|type-safe|strongly typed)\b/i,
        score: 8,
      },
      {
        regex:
          /\b(interface|type alias|enum|generic|type parameter|infer|keyof|typeof|ReturnType|Partial|Required|Pick|Omit)\b/i,
        score: 10,
      },
      {
        regex:
          /\b(add types|fix type|type annotation|type definition|type declaration|typed)\b/i,
        score: 10,
      },
      {
        regex:
          /\b(\.d\.ts|types\/|@types\/|as unknown|any type|implicit any)\b/i,
        score: 9,
      },
      { regex: /\bTS\d{4}\b/i, score: 12 }, // TSxxxx error codes
    ],
  },

  // ─── question ────────────────────────────────────────────────────────────
  // Lowest priority — only wins when nothing else has a strong signal.
  {
    intent: "question",
    patterns: [
      {
        regex:
          /\b(how does|how do|how can|how should|what is|what are|what's|why (is|does|do|did|doesn't)|explain|can you explain|tell me about|what's the best way)\b/i,
        score: 10,
      },
      {
        regex: /\b(understand|overview|architecture|structure|concept)\b/i,
        score: 6,
      },
      { regex: /\?$/, score: 5 },
    ],
  },
];

/**
 * Classify a user message into one of the 12 intent types.
 * Returns the intent with the highest cumulative keyword score.
 */
export function classifyIntent(message: string): Intent {
  const scores = new Map<Intent, number>();

  for (const rule of RULES) {
    let total = 0;
    for (const { regex, score } of rule.patterns) {
      if (regex.test(message)) {
        total += score;
      }
    }
    if (total > 0) {
      scores.set(rule.intent, (scores.get(rule.intent) ?? 0) + total);
    }
  }

  if (scores.size === 0) {
    return "question";
  }

  let best: Intent = "question";
  let bestScore = 0;
  for (const [intent, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      best = intent;
    }
  }

  return best;
}
