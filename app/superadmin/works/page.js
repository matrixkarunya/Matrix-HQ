import RoleGuard from "@/components/RoleGuard";
import WorksManager from "@/components/WorksManager";

export default function SuperadminWorksPage() {
  return <RoleGuard allow={["superadmin"]}><WorksManager /></RoleGuard>;
}