import MemberTodoView from "@/components/MemberTodoView";

export default function AdminTodoPage() {
  return <MemberTodoView allowedRoles={["admin"]} />;
}
