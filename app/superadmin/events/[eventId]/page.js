import RoleGuard from "@/components/RoleGuard";
import EventTodo from "@/components/EventTodo";

export default function SuperadminEventTodoPage() {
  return (
    <RoleGuard allow={["superadmin"]}>
      <EventTodo />
    </RoleGuard>
  );
}
