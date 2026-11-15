import MemberAttendanceView from "@/components/MemberAttendanceView";

export default function AdminAttendancePage() {
  return <MemberAttendanceView allowedRoles={["admin"]} />;
}