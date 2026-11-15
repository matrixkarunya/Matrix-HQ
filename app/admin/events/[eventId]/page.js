import RoleGuard from "@/components/RoleGuard";
import EventTodo from "@/components/EventTodo";

export default function AdminEventTodoPage() {
  return (
    <RoleGuard allow={["admin"]}>
      <EventTodo />
    </RoleGuard>
  );
}
