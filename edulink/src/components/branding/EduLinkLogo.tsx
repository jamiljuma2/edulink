type LogoProps = {
  className?: string;
};

export default function EduLinkLogo({ className }: LogoProps) {
  return (
    <div className={className} aria-label="EduLink Writers logo">
      <svg viewBox="0 0 240 80" role="img" className="h-12 w-auto">
        <defs>
          <linearGradient id="edulinkGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1E3A8A" />
            <stop offset="60%" stopColor="#059669" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
        <g fill="none" fillRule="evenodd">
          <path
            d="M28 20c12-9 28-9 40 0v30c-12-9-28-9-40 0V20Z"
            fill="url(#edulinkGradient)"
            opacity="0.95"
          />
          <path
            d="M72 20c12-9 28-9 40 0v30c-12-9-28-9-40 0V20Z"
            fill="#EAF2FF"
            stroke="#1E3A8A"
            strokeWidth="2"
          />
          <path
            d="M70 28l24 24"
            stroke="#059669"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="94" cy="28" r="4" fill="#059669" />
          <circle cx="70" cy="52" r="4" fill="#059669" />
          <path
            d="M122 18h6v44h-6z"
            fill="#1E3A8A"
          />
          <rect x="129" y="18" width="8" height="8" rx="2" fill="#F59E0B" />
          <path
            d="M132 30h6v32h-6z"
            fill="#1E3A8A"
          />
          <path
            d="M145 30h6v22c0 4 3 6 7 6 5 0 7-3 7-7V30h6v32h-6v-4c-2 3-6 5-11 5-6 0-9-4-9-10V30Z"
            fill="#1E3A8A"
          />
          <path
            d="M173 30h6v4c2-3 6-5 11-5 7 0 11 4 11 11v22h-6V41c0-4-2-7-7-7-5 0-9 3-9 9v19h-6V30Z"
            fill="#1E3A8A"
          />
          <path
            d="M210 30h6v32h-6V30Z"
            fill="#1E3A8A"
          />
          <rect x="210" y="18" width="6" height="8" rx="2" fill="#F59E0B" />
          <text x="122" y="72" fontFamily="Poppins, Inter, sans-serif" fontSize="14" fill="#1E293B">EduLink Writers</text>
        </g>
      </svg>
    </div>
  );
}
