import RoleGuard from "@/components/RoleGuard";
import MyProfile from "@/components/MyProfile";

export default function MemberMyProfilePage() {
  return (
    <RoleGuard allow={["member"]}>
      <MyProfile />
    </RoleGuard>
  );
}