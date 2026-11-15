import RoleGuard from "@/components/RoleGuard";
import EventAttendance from "@/components/EventAttendance";

export default function SuperadminEventAttendancePage() {
  return (
    <RoleGuard allow={["superadmin"]}>
      <EventAttendance />
    </RoleGuard>
  );
}