import RoleGuard from "@/components/RoleGuard";
import MyProfile from "@/components/MyProfile";

export default function AdminMyProfilePage() {
  return (
    <RoleGuard allow={["admin"]}>
      <MyProfile />
    </RoleGuard>
  );
}