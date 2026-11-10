import { AuthForm } from "@/features/auth/auth-form";

export const metadata = { title: "Registrieren" };

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
