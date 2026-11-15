import RoleGuard from "@/components/RoleGuard";
import MeetingsManager from "@/components/MeetingsManager";

export default function AdminMeetingsPage() {
  return <RoleGuard allow={["admin"]}><MeetingsManager /></RoleGuard>;
}