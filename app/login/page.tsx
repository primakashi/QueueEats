import { UtensilsCrossed } from "lucide-react";
import { LoginForm } from "./login-form";

type Props = {
  searchParams: Promise<{ redirect?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { redirect } = await searchParams;
  return (
    <main className="grid min-h-0 flex-1 place-items-center overflow-y-auto p-6 bg-muted/30 [-webkit-overflow-scrolling:touch]">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground grid place-items-center">
            <UtensilsCrossed className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Al Jazeerah Express POS</h1>
          <p className="text-sm text-muted-foreground">
            Masuk ke akun staf Anda
          </p>
        </div>
        <LoginForm redirectTo={redirect} />
      </div>
    </main>
  );
}
