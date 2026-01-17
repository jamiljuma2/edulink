import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  label: string;
  icon: LucideIcon;
};

type DashboardShellProps = {
  roleLabel: string;
  title: string;
  subtitle?: string;
  navItems: NavItem[];
  headerRight?: ReactNode;
  children: ReactNode;
};

export default function DashboardShell({
  roleLabel,
  title,
  subtitle,
  navItems,
  headerRight,
  children,
}: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="mx-auto flex w-full max-w-6xl gap-6 px-6 py-8">
        <aside className="hidden w-60 flex-col gap-4 md:flex">
          <div className="card">
            <p className="text-sm text-[color:var(--muted)]">{roleLabel}</p>
            <p className="text-lg font-semibold">Dashboard</p>
          </div>
          <nav className="card space-y-2 text-sm">
            {navItems.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-[color:var(--muted)]">
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </div>
            ))}
          </nav>
        </aside>

        <section className="flex-1 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">{title}</h1>
              {subtitle && <p className="text-sm text-[color:var(--muted)]">{subtitle}</p>}
            </div>
            {headerRight}
          </div>
          {children}
        </section>
      </div>
    </div>
  );
}
