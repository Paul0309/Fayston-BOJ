export default function Icon({ name, size = 16, className = "", ...props }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    className,
    ...props,
  };

  switch (name) {
    case "contest":
      return (
        <svg {...common}>
          <rect x="6" y="3" width="12" height="18" rx="2" />
          <path d="M9 7h6M9 11h6M9 15h4" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...common}>
          <path d="M8 21h8M12 17v4" />
          <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
          <path d="M7 6H5a2 2 0 0 0 2 3M17 6h2a2 2 0 0 1-2 3" />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
        </svg>
      );
    case "lock":
      return (
        <svg {...common}>
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10V8a4 4 0 1 1 8 0v2" />
        </svg>
      );
    case "compiler":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M8 9h8M8 13h5" />
        </svg>
      );
    case "editor":
      return (
        <svg {...common}>
          <path d="m8 7-4 5 4 5M16 7l4 5-4 5" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3 5 6v6c0 4.5 3 7.7 7 9 4-1.3 7-4.5 7-9V6l-7-3Z" />
        </svg>
      );
    case "back":
      return (
        <svg {...common}>
          <path d="m15 18-6-6 6-6" />
        </svg>
      );
    case "forward":
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "memory":
      return (
        <svg {...common}>
          <rect x="5" y="7" width="14" height="10" rx="2" />
          <path d="M9 10h6M9 14h3M8 4v3M12 4v3M16 4v3M8 17v3M12 17v3M16 17v3" />
        </svg>
      );
    case "play":
      return (
        <svg {...common}>
          <path d="m9 7 8 5-8 5V7Z" />
        </svg>
      );
    case "submit":
      return (
        <svg {...common}>
          <path d="M12 16V6M8.5 9.5 12 6l3.5 3.5" />
          <rect x="5" y="16" width="14" height="4" rx="1.5" />
        </svg>
      );
    case "home":
      return (
        <svg {...common}>
          <path d="m4 11 8-7 8 7" />
          <path d="M6.5 10.5V20h11v-9.5" />
        </svg>
      );
    case "archive":
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="4" rx="1" />
          <path d="M6 9v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9" />
          <path d="M10 13h4" />
        </svg>
      );
    default:
      return null;
  }
}
