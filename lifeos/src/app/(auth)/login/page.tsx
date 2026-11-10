import { AuthForm } from "@/features/auth/auth-form";

export const metadata = { title: "Anmelden" };

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
