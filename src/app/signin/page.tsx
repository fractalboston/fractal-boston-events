import { redirect } from "next/navigation";

export default function SigninRedirect(): never {
  redirect("/login");
}
