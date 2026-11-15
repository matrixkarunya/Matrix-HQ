import RoleGuard from "@/components/RoleGuard";
import MeetingAttendance from "@/components/MeetingAttendance";

export default function SuperadminMeetingAttendancePage() {
  return <RoleGuard allow={["superadmin"]}><MeetingAttendance /></RoleGuard>;
}