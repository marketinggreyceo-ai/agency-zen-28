import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-4 text-muted-foreground">Страница не найдена</p>
        <a href="/" className="mt-6 inline-block text-teal underline">На главную</a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "root" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >Попробовать снова</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "GA Agency OS" },
      { name: "description", content: "Внутренняя система управления агентством" },
      { property: "og:title", content: "GA Agency OS" },
      { name: "twitter:title", content: "GA Agency OS" },
      { property: "og:description", content: "Внутренняя система управления агентством" },
      { name: "twitter:description", content: "Внутренняя система управления агентством" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fc3bf8e0-a782-4a93-8838-b3d8d1a90595/id-preview-82b31aea--b3a75de7-3570-4508-84e1-e4c11a122262.lovable.app-1781734430449.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fc3bf8e0-a782-4a93-8838-b3d8d1a90595/id-preview-82b31aea--b3a75de7-3570-4508-84e1-e4c11a122262.lovable.app-1781734430449.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <head><HeadContent /></head>
      <body className="bg-background text-foreground">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster theme="dark" />
    </QueryClientProvider>
  );
}
