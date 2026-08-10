import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/uniquify")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/app/uniquify" });
  },
});
