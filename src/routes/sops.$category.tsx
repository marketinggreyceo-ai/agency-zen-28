import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const Route = createFileRoute("/sops/$category")({
  component: Page,
});

const LABELS: Record<string, string> = {
  editing: "Монтаж", posting: "Постинг", chatting: "Чаттинг",
  content: "Контент", hiring: "Найм", general: "Общее",
};

function Page() {
  const { category } = Route.useParams();
  const { data: sops = [], isLoading } = useQuery({
    queryKey: ["public-sops", category],
    queryFn: async () => (await supabase.from("sops").select("*").eq("category", category).order("updated_at", { ascending: false })).data ?? [],
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-10">
        <h1 className="text-3xl font-semibold mb-1">{LABELS[category] ?? category}</h1>
        <p className="text-sm text-text2 mb-8">Стандарты и инструкции</p>
        {isLoading && <p className="text-text2">Загрузка...</p>}
        {!isLoading && sops.length === 0 && <p className="text-text2">Нет инструкций в этой категории.</p>}
        <div className="space-y-10">
          {sops.map((s: any) => (
            <article key={s.id} className="prose prose-invert prose-sm max-w-none">
              <h2 className="!mb-2">{s.title}</h2>
              <div className="text-xs text-text3 !mt-0">Обновлено: {new Date(s.updated_at).toLocaleDateString("ru-RU")}</div>
              <div className="mt-4">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.content ?? ""}</ReactMarkdown>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
