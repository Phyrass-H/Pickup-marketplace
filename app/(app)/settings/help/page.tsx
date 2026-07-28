import { HelpLegalCard } from "@/components/help-legal-card";
import { SettingsHeader } from "@/components/settings-header";

export default function HelpSettingsPage() {
  return (
    <>
      <SettingsHeader title="Help and legal" />
      <HelpLegalCard variant="driver" />
    </>
  );
}
