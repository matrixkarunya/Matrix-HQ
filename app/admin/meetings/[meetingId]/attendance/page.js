import RoleGuard from "@/components/RoleGuard";
import MeetingAttendance from "@/components/MeetingAttendance";

export default function AdminMeetingAttendancePage() {
  return <RoleGuard allow={["admin"]}><MeetingAttendance /></RoleGuard>;
}