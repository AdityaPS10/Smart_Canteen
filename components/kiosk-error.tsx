export function KioskError({ message }: { message: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6 text-center">
      <p className="text-2xl text-muted-foreground">{message}</p>
    </main>
  );
}
