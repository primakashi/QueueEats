import { SolusiSajiMark } from "@/components/solusi-saji-mark";
import { LoginForm } from "./login-form";

type Props = {
  searchParams: Promise<{ redirect?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const { redirect } = await searchParams;
  return (
    <main className="grid min-h-0 flex-1 place-items-center overflow-y-auto p-6 bg-muted/30 [-webkit-overflow-scrolling:touch]">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <SolusiSajiMark className="h-12 w-auto" />
          <p className="text-sm text-muted-foreground">
            Masuk ke akun restoran Anda
          </p>
        </div>
        <LoginForm redirectTo={redirect} />
      </div>
    </main>
  );
}
