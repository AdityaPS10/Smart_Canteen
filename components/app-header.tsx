import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";

const ROLE_LABEL = { student: "Student", food_server: "Food server", cashier: "Cashier" } as const;

export async function AppHeader({ links = [] }: { links?: Array<{ href: string; label: string }> }) {
  const session = await auth();
  const user = session?.user;
  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="font-bold">
          Smart Canteen
        </Link>
        <nav className="flex flex-1 flex-wrap gap-3 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-muted-foreground hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
        {user && (
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: user.role === "student" ? "/login" : "/staff/login" });
            }}
            className="flex items-center gap-2"
          >
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user.name} · {ROLE_LABEL[user.role]}
            </span>
            <Button size="sm" variant="ghost" type="submit">
              Log out
            </Button>
          </form>
        )}
      </div>
    </header>
  );
}
