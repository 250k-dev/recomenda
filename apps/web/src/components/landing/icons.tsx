import type { ReactElement, SVGProps } from "react";
import type { IconName } from "./content";

type IconProps = SVGProps<SVGSVGElement>;

/** Shared stroke-based icon frame (24px grid). Decorative by default. */
function Svg({ children, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const Sprout = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 20h10" />
    <path d="M12 20c0-5 0-8 0-10" />
    <path d="M12 11c0-2.5-1.8-4.6-4.5-4.9C6.4 6 5.6 6 5 6c0 .7 0 1.5.1 2.5C5.4 11.2 7.5 13 10 13" />
    <path d="M12 10c0-2.6 1.9-4.8 4.7-5.1.9-.1 1.7-.1 2.3-.1 0 .7 0 1.6-.1 2.6C18.5 10.2 16.4 12 13.8 12" />
  </Svg>
);

export const Calendar = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
    <path d="M3 9h18M8 3v3M16 3v3" />
    <circle cx="12" cy="14.5" r="2.6" />
    <path d="M12 13.4v1.2l.9.7" />
  </Svg>
);

export const Beaker = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 3h6M10 3v6.2L5.4 17a2 2 0 0 0 1.7 3h9.8a2 2 0 0 0 1.7-3L14 9.2V3" />
    <path d="M7.5 14h9" />
  </Svg>
);

export const Clipboard = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="4" width="14" height="17" rx="2.5" />
    <path d="M9 4a3 3 0 0 1 6 0" />
    <path d="M9 11h6M9 15h4" />
    <path d="M8.4 11.5 9 12l1.2-1.2" />
  </Svg>
);

export const Boxes = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 8.5 6.5 5.5 12 2.5l5.5 3L12 8.5Z" />
    <path d="M6.5 5.5v6L12 14.5v-6" />
    <path d="M17.5 5.5v6L12 14.5" />
    <path d="M12 14.5v6M6.5 11.5 3.5 13v5.5L9 21m6 0 5.5-2.5V13l-3-1.5" />
  </Svg>
);

export const Chart = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 4v15a1 1 0 0 0 1 1h15" />
    <path d="M8 16v-3M12 16v-6M16 16v-4M20 16V8" />
  </Svg>
);

export const WifiOff = (p: IconProps) => (
  <Svg {...p}>
    <path d="m3 3 18 18" />
    <path d="M8.5 12.6a5 5 0 0 1 7 .1" />
    <path d="M5 9.4A10 10 0 0 1 9.8 7M14.5 7.3A10 10 0 0 1 19 9.4" />
    <path d="M2 6.5A14 14 0 0 1 6 4M18.5 4.2A14 14 0 0 1 22 6.5" />
    <path d="M12 18h.01" />
  </Svg>
);

export const Users = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 5.9" />
    <path d="M17 14.5a5.5 5.5 0 0 1 3.5 5.1" />
  </Svg>
);

export const Refresh = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 11a8 8 0 0 0-14.3-4.6M4 4v3.5h3.5" />
    <path d="M4 13a8 8 0 0 0 14.3 4.6M20 20v-3.5h-3.5" />
  </Svg>
);

export const Tag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 11.3V4.5a1 1 0 0 1 1-1h6.8a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8l-5.8 5.8a2 2 0 0 1-2.8 0l-7-7a2 2 0 0 1-.6-1.4Z" />
    <circle cx="8" cy="8" r="1.4" />
  </Svg>
);

export const Shield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 5 5.6v5.2c0 4.3 3 7.6 7 9.2 4-1.6 7-4.9 7-9.2V5.6L12 3Z" />
    <path d="m9 11.8 2 2 4-4" />
  </Svg>
);

export const Layers = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 3 8.5 4.4L12 11.8 3.5 7.4 12 3Z" />
    <path d="m4 12 8 4.2L20 12" />
    <path d="m4 16.5 8 4.2 8-4.2" />
  </Svg>
);

export const Phone = (p: IconProps) => (
  <Svg {...p}>
    <rect x="7" y="2.5" width="10" height="19" rx="2.6" />
    <path d="M11 5.5h2" />
    <path d="M10.5 18.5h3" />
  </Svg>
);

export const Monitor = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M9 20h6M12 16v4" />
  </Svg>
);

export const Wheat = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 21V9" />
    <path d="M12 9c0-2 1.4-3.4 3.4-3.4C15.4 7.6 14 9 12 9Z" />
    <path d="M12 9c0-2-1.4-3.4-3.4-3.4C8.6 7.6 10 9 12 9Z" />
    <path d="M12 13.5c0-2 1.4-3.4 3.4-3.4C15.4 12.1 14 13.5 12 13.5Z" />
    <path d="M12 13.5c0-2-1.4-3.4-3.4-3.4C8.6 12.1 10 13.5 12 13.5Z" />
    <path d="M12 18c0-2 1.4-3.4 3.4-3.4C15.4 16.6 14 18 12 18Z" />
    <path d="M12 18c0-2-1.4-3.4-3.4-3.4C8.6 16.6 10 18 12 18Z" />
  </Svg>
);

export const Handshake = (p: IconProps) => (
  <Svg {...p}>
    <path d="m11 17-2.1 2.1a1.5 1.5 0 0 1-2.1-2.1l4.2-4.2" />
    <path d="M3 7.5 6 5l4.5 1.5L13 5l3 1.5" />
    <path d="M21 13.5 15.5 8l-3 2.5a1.6 1.6 0 0 0 0 2.3l.2.2a1.6 1.6 0 0 0 2.3 0" />
    <path d="M14.5 13.5 17 16M12.5 15.5 15 18M3 8v5l2 1.5M21 8v5l-2 1.5" />
  </Svg>
);

export const Route = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="18.5" r="2.2" />
    <circle cx="18" cy="5.5" r="2.2" />
    <path d="M8 18.5h6.5a3 3 0 0 0 0-6h-5a3 3 0 0 1 0-6H16" />
  </Svg>
);

export const Bell = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
    <path d="M10.5 19a1.7 1.7 0 0 0 3 0" />
  </Svg>
);

/* ---- Standalone glyphs used in UI (arrows, checks, chrome) ---- */

export const ArrowRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </Svg>
);

export const Check = (p: IconProps) => (
  <Svg strokeWidth={2} {...p}>
    <path d="m4.5 12.5 4.5 4.5 10.5-11" />
  </Svg>
);

export const Menu = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

export const Close = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const Star = (p: IconProps) => (
  <Svg fill="currentColor" stroke="none" {...p}>
    <path d="M12 3.5l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.9l-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3.5Z" />
  </Svg>
);

export const Sun = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
  </Svg>
);

/** Map an IconName from content.ts to its component. */
const registry: Record<IconName, (p: IconProps) => ReactElement> = {
  sprout: Sprout,
  calendar: Calendar,
  beaker: Beaker,
  clipboard: Clipboard,
  boxes: Boxes,
  chart: Chart,
  wifiOff: WifiOff,
  users: Users,
  refresh: Refresh,
  tag: Tag,
  shield: Shield,
  layers: Layers,
  phone: Phone,
  monitor: Monitor,
  wheat: Wheat,
  handshake: Handshake,
  route: Route,
  bell: Bell,
};

export function Icon({ name, ...props }: { name: IconName } & IconProps) {
  const Cmp = registry[name];
  return <Cmp {...props} />;
}
