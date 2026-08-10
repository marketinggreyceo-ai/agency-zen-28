import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/uniquify")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reel Uniquifier" },
      { name: "description", content: "Уникализатор рилсов — обработка видео прямо в браузере." },
      { property: "og:title", content: "Reel Uniquifier" },
      { property: "og:description", content: "Уникализатор рилсов — обработка видео прямо в браузере." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="w-full">
      <iframe
        src="https://144-172-94-152.sslip.io"
        title="Reel Uniquifier"
        className="w-full block"
        style={{ border: "none", minHeight: 1400, height: "100vh" }}
      />
    </div>
  );
}
