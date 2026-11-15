import RoleGuard from "@/components/RoleGuard";
import MeetingsManager from "@/components/MeetingsManager";

export default function SuperadminMeetingsPage() {
  return <RoleGuard allow={["superadmin"]}><MeetingsManager /></RoleGuard>;
}