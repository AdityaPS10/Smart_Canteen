import Link from "next/link";
import { LogOut, UtensilsCrossed } from "lucide-react";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ROLE_LABEL = { student: "Student", food_server: "Food server", cashier: "Cashier" } as const;

export async function AppHeader({
  links = [],
  wide = false,
}: {
  links?: Array<{ href: string; label: string }>;
  /** Match full-width screens such as the kitchen display. */
  wide?: boolean;
}) {
  const session = await auth();
  const user = session?.user;
  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className={cn("mx-auto flex h-14 max-w-6xl items-center gap-4 px-4", wide && "max-w-7xl 2xl:max-w-[110rem]")}>
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <UtensilsCrossed className="size-4" aria-hidden />
          </span>
          <span className="hidden sm:inline">Smart Canteen</span>
        </Link>
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
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
            className="flex items-center gap-3"
          >
            <span className="hidden flex-col items-end leading-tight md:flex">
              <span className="text-sm font-medium">{user.name}</span>
              <span className="text-sm text-muted-foreground">{ROLE_LABEL[user.role]}</span>
            </span>
            <Button size="sm" variant="outline" type="submit" aria-label="Log out">
              <LogOut /> <span className="hidden sm:inline">Log out</span>
            </Button>
          </form>
        )}
      </div>
    </header>
  );
}
