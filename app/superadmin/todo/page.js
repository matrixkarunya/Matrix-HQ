import MemberTodoView from "@/components/MemberTodoView";

export default function SuperadminTodoPage() {
  return <MemberTodoView allowedRoles={["superadmin"]} />;
}
