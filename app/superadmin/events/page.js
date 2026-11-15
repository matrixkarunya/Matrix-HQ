import RoleGuard from "@/components/RoleGuard";
import EventsManager from "@/components/EventsManager";

export default function SuperadminEventsPage() {
  return (
    <RoleGuard allow={["superadmin"]}>
      <EventsManager />
    </RoleGuard>
  );
}
