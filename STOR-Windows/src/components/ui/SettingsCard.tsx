import type { ReactNode } from "react";

interface SettingsCardProps {
  title: string;
  status?: string;
  children: ReactNode;
}

export function SettingsCard({ title, status, children }: SettingsCardProps) {
  return (
    <section className="settings-card">
      <div className="settings-card-head">
        <h2>{title}</h2>
        {status && <p>{status}</p>}
      </div>
      {children}
    </section>
  );
}
