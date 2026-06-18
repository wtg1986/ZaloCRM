import { redirect } from "next/navigation";

// Root → Hộp thư. Auth guard ở (app)/layout sẽ đẩy về /login nếu chưa đăng nhập.
export default function Home() {
  redirect("/inbox");
}
