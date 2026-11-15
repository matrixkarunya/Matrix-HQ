import RoleGuard from "@/components/RoleGuard";
import EventTodo from "@/components/EventTodo";

export default function MemberEventTodoPage() {
  return (
    <RoleGuard allow={["member"]}>
      <EventTodo readOnly />
    </RoleGuard>
  );
}
