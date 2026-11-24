import RoleGuard from "@/components/RoleGuard";
import WorksManager from "@/components/WorksManager";

export default function AdminWorksPage() {
  return <RoleGuard allow={["admin"]}><WorksManager /></RoleGuard>;
}