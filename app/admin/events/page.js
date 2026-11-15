import RoleGuard from "@/components/RoleGuard";
import EventsManager from "@/components/EventsManager";

export default function AdminEventsPage() {
  return (
    <RoleGuard allow={["admin"]}>
      <EventsManager />
    </RoleGuard>
  );
}
