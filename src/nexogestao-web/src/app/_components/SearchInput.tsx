"use client";

import { inputStyle } from "./ui";

export default function SearchInput({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 dark:text-white/40 pointer-events-none"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputStyle} w-full pl-9`}
      />
    </div>
  );
}
