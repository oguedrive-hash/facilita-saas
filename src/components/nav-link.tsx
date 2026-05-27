"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  children,
  variant = "default",
  exact = false,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "default" | "admin";
  exact?: boolean;
}) {
  const pathname = usePathname();
  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + "/");

  const baseClasses =
    "relative text-sm font-heading font-medium pb-1 transition";

  if (variant === "admin") {
    // Link "Admin" do menu cliente — laranja vibrante
    return (
      <Link
        href={href}
        className={`${baseClasses} ${
          isActive
            ? "text-laranja-escuro font-semibold"
            : "text-laranja hover:text-laranja-escuro"
        }`}
      >
        {children}
        {isActive && (
          <span className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-laranja" />
        )}
      </Link>
    );
  }

  // Links normais (Dashboard, Leads, Agenda)
  return (
    <Link
      href={href}
      className={`${baseClasses} ${
        isActive
          ? "text-preto font-semibold"
          : "text-cinza-medio hover:text-preto"
      }`}
    >
      {children}
      {isActive && (
        <span className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-laranja" />
      )}
    </Link>
  );
}
