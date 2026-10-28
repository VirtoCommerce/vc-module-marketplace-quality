import { computed, type ComputedRef } from "vue";
import { useAsync, useUser } from "@vc-shell/framework";
import { useAiAgent } from "@vc-shell/framework/ai-agent";

export interface IRunScoringArgs {
  /** Quality expert agent of the entity type, and the message it is sent. */
  agentId: string;
  prompt: string;
  item: { id: string; name?: string; objectType?: string };
  blade: { id: string; name: string; title: string };
  locale: string;
}

export interface IUseQualityScoring {
  scoring: ComputedRef<boolean>;
  canScore: ComputedRef<boolean>;
  runScoring: (args?: IRunScoringArgs) => Promise<void>;
}

export function useQualityScoring(): IUseQualityScoring {
  const aiAgent = useAiAgent();
  const { getAccessToken } = useUser();

  const chatUrl = computed(() => {
    const agentUrl = aiAgent?.config.value.url;
    return agentUrl ? new URL("/api/chat", agentUrl).toString() : undefined;
  });

  const { action: runScoring, loading } = useAsync<IRunScoringArgs>(async (args) => {
    if (!args?.item.id || !args.agentId) return;
    if (!chatUrl.value) throw new Error("AI agent URL is not configured");

    const response = await fetch(chatUrl.value, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await getAccessToken()}`,
      },
      body: JSON.stringify({
        type: "message",
        agent_id: args.agentId,
        message: args.prompt,
        thread_id: crypto.randomUUID(),
        context: {
          context_type: "details",
          locale: args.locale,
          blade: args.blade,
          item: { id: args.item.id, objectType: args.item.objectType ?? "", name: args.item.name },
        },
      }),
    });

    if (!response.ok) {
      // 404 unknown agent, 422 malformed request, 503 agent failed to start
      throw new Error(`${response.status}: ${await response.text()}`);
    }

    const errorMessage = await readErrors(response);
    if (errorMessage) throw new Error(errorMessage);
  });

  return {
    scoring: computed(() => loading.value),
    canScore: computed(() => !!chatUrl.value),
    runScoring,
  };
}

async function readErrors(response: Response): Promise<string | undefined> {
  if (!response.body) return undefined;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let errorMessage: string | undefined;

  const handleLine = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === "error") errorMessage = event.message;
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(handleLine);
  }
  handleLine(buffer + decoder.decode());

  return errorMessage;
}
