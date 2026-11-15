import RoleGuard from "@/components/RoleGuard";
import EventAttendance from "@/components/EventAttendance";

export default function AdminEventAttendancePage() {
  return (
    <RoleGuard allow={["admin"]}>
      <EventAttendance />
    </RoleGuard>
  );
}