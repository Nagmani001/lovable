import { cn } from "@repo/ui/lib/utils";

export function LovableLogo({
  className,
  size = 32,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 180 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
    >
      <mask
        id="logo-mask"
        style={{ maskType: "alpha" }}
        maskUnits="userSpaceOnUse"
        x="1"
        y="0"
        width="178"
        height="180"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M54.6052 0C83.9389 0 107.719 23.8424 107.719 53.2535V73.4931H125.395C154.729 73.4931 178.508 97.3355 178.508 126.747C178.508 156.158 154.729 180 125.395 180H1.4917V53.2535C1.4917 23.8424 25.2714 0 54.6052 0Z"
          fill="url(#logo-grad)"
        />
      </mask>
      <g mask="url(#logo-mask)">
        <g filter="url(#f0)">
          <circle cx="79.14" cy="96.09" r="119.83" fill="#4B73FF" />
        </g>
        <g filter="url(#f1)">
          <ellipse
            cx="92.32"
            cy="30.33"
            rx="153.47"
            ry="119.83"
            fill="#FF66F4"
          />
        </g>
        <g filter="url(#f2)">
          <ellipse
            cx="117.35"
            cy="7.77"
            rx="119.83"
            ry="105.23"
            fill="#FF0105"
          />
        </g>
        <g filter="url(#f3)">
          <circle cx="94.43" cy="30.3" r="72.06" fill="#FE7B02" />
        </g>
      </g>
      <defs>
        <filter
          id="f0"
          x="-94.39"
          y="-77.44"
          width="347.06"
          height="347.06"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="bg" />
          <feBlend in="SourceGraphic" in2="bg" result="s" />
          <feGaussianBlur stdDeviation="26.85" />
        </filter>
        <filter
          id="f1"
          x="-114.85"
          y="-143.2"
          width="414.33"
          height="347.06"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="bg" />
          <feBlend in="SourceGraphic" in2="bg" result="s" />
          <feGaussianBlur stdDeviation="26.85" />
        </filter>
        <filter
          id="f2"
          x="-56.18"
          y="-151.16"
          width="347.06"
          height="317.87"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="bg" />
          <feBlend in="SourceGraphic" in2="bg" result="s" />
          <feGaussianBlur stdDeviation="26.85" />
        </filter>
        <filter
          id="f3"
          x="-31.34"
          y="-95.47"
          width="251.53"
          height="251.53"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="bg" />
          <feBlend in="SourceGraphic" in2="bg" result="s" />
          <feGaussianBlur stdDeviation="26.85" />
        </filter>
        <linearGradient
          id="logo-grad"
          x1="61.06"
          y1="31.63"
          x2="114.99"
          y2="179.93"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0.025" stopColor="#FF8E63" />
          <stop offset="0.56" stopColor="#FF7EB0" />
          <stop offset="0.95" stopColor="#4B73FF" />
        </linearGradient>
      </defs>
    </svg>
  );
}
