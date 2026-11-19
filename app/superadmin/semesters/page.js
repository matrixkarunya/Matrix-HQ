import RoleGuard from "@/components/RoleGuard";
import SemesterManager from "@/components/SemesterManager";

export default function SuperadminSemestersPage() {
  return <RoleGuard allow={["superadmin"]}><SemesterManager /></RoleGuard>;
}