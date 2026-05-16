import { StateGraph, START, END, Command } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { StructuredToolInterface } from "@langchain/core/tools";
import {
  AIMessage,
  HumanMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { StreamChunk } from "@repo/common/types";
import type { ContextManager } from "@repo/orchestrator/context";
import type { Sandbox } from "e2b";
import { runTypeCheck, runBuildCheck } from "@repo/orchestrator/check";
import { filterErrorsByFiles } from "@repo/orchestrator/parser";
import { AgentState, type AgentStateType } from "./state.js";

const MAX_CODE_ITERATIONS = 25;
const MAX_FIXUP_ITERATIONS = 3;
const MAX_FIXUP_AGENT_STEPS = 10;

interface BuildGraphParams {
  model: BaseChatModel;
  tools: StructuredToolInterface[];
  sandbox: Sandbox;
  projectBasePath: string;
  contextManager: ContextManager;
  onStream: (chunk: StreamChunk) => void;
}

export function buildAgentGraph(params: BuildGraphParams) {
  const { model, tools, sandbox, projectBasePath, contextManager, onStream } =
    params;

  if (!model.bindTools) {
    throw new Error("Provided chat model does not support bindTools");
  }
  const modelWithTools = model.bindTools(tools);
  const toolNode = new ToolNode(tools, { handleToolErrors: true });

  const codeAgent = async (state: AgentStateType) => {
    console.log("code agent ran");
    onStream({ type: "status", status: "thinking" });
    const response = await modelWithTools.invoke(state.messages);
    if (typeof response.content === "string" && response.content) {
      onStream({ type: "text", content: response.content });
    }
    if (response.tool_calls && response.tool_calls.length > 0) {
      onStream({ type: "status", status: "writing" });
    }
    return { messages: [response] };
  };

  const fixupAgent = async (state: AgentStateType) => {
    console.log("fixup agent ran");
    onStream({ type: "status", status: "fixing" });
    const response = await modelWithTools.invoke(state.messages);
    if (typeof response.content === "string" && response.content) {
      onStream({ type: "text", content: response.content });
    }
    return { messages: [response] };
  };

  const lastMsgHasToolCalls = (state: AgentStateType): boolean => {
    const last = state.messages[state.messages.length - 1] as
      | BaseMessage
      | undefined;
    if (!last) return false;
    const aiMsg = last as AIMessage;
    return Array.isArray(aiMsg.tool_calls) && aiMsg.tool_calls.length > 0;
  };

  const FIXUP_MARKER = "__lg_fixup_turn_marker__";

  const stepsSinceFixupStart = (state: AgentStateType): number => {
    let steps = 0;
    for (let i = state.messages.length - 1; i >= 0; i--) {
      const m = state.messages[i] as BaseMessage;
      const content = typeof m.content === "string" ? m.content : "";
      if (m.getType() === "human" && content.includes(FIXUP_MARKER)) break;
      if (m.getType() === "ai") steps++;
    }
    return steps;
  };

  const routeCode = (state: AgentStateType): "tools_code" | "tsc_check" => {
    return lastMsgHasToolCalls(state) ? "tools_code" : "tsc_check";
  };

  const tscCheck = async (
    state: AgentStateType,
  ): Promise<Command<"tsc_fixup_agent" | "build_check">> => {
    const modified = contextManager.getModifiedFiles();
    if (modified.length === 0 || state.fixupAttempt >= MAX_FIXUP_ITERATIONS) {
      if (state.fixupAttempt >= MAX_FIXUP_ITERATIONS) {
        onStream({
          type: "text",
          content:
            "\n\n(Some TypeScript errors may remain after automatic fix-up attempts.)",
        });
      }
      return new Command({
        goto: "build_check",
        update: { fixupAttempt: 0 },
      });
    }

    onStream({ type: "status", status: "fixing" });
    const tscOutput = await runTypeCheck(sandbox, projectBasePath);
    const { filteredErrors, errorFiles } = filterErrorsByFiles(
      tscOutput,
      modified,
    );

    if (!filteredErrors) {
      return new Command({
        goto: "build_check",
        update: { fixupAttempt: 0 },
      });
    }

    const fixupContext = contextManager.generateTypeCheckContext(
      filteredErrors,
      errorFiles,
    );

    const injection = new HumanMessage({
      content: `${FIXUP_MARKER}\n${fixupContext}\n\nThe TypeScript compiler found errors in files you modified. Please fix ALL errors using lov-line-replace or lov-write. Do NOT explain anything — just fix the code.`,
    });

    return new Command({
      goto: "tsc_fixup_agent",
      update: {
        messages: [injection],
        fixupAttempt: state.fixupAttempt + 1,
      },
    });
  };

  const routeTscFixup = (
    state: AgentStateType,
  ): "tools_tsc_fixup" | "tsc_check" => {
    return lastMsgHasToolCalls(state) ? "tools_tsc_fixup" : "tsc_check";
  };

  const routeTscFixupTools = (
    state: AgentStateType,
  ): "tsc_fixup_agent" | "tsc_check" => {
    if (stepsSinceFixupStart(state) >= MAX_FIXUP_AGENT_STEPS)
      return "tsc_check";
    return "tsc_fixup_agent";
  };

  const buildCheck = async (
    state: AgentStateType,
  ): Promise<Command<"build_fixup_agent" | typeof END>> => {
    const modified = contextManager.getModifiedFiles();
    if (modified.length === 0 || state.fixupAttempt >= MAX_FIXUP_ITERATIONS) {
      onStream({ type: "status", status: "done" });
      return new Command({ goto: END });
    }

    onStream({ type: "status", status: "fixing" });
    const buildErrors = await runBuildCheck(sandbox, projectBasePath);
    if (!buildErrors) {
      onStream({ type: "status", status: "done" });
      return new Command({ goto: END });
    }

    const buildContext = contextManager.generateTypeCheckContext(
      buildErrors,
      modified,
    );

    const injection = new HumanMessage({
      content: `${FIXUP_MARKER}\n${buildContext}\n\nThe project build (vite build) failed with the errors shown above. Please fix ALL errors using lov-line-replace or lov-write. Do NOT explain anything — just fix the code.`,
    });

    return new Command({
      goto: "build_fixup_agent",
      update: {
        messages: [injection],
        fixupAttempt: state.fixupAttempt + 1,
      },
    });
  };

  const routeBuildFixup = (
    state: AgentStateType,
  ): "tools_build_fixup" | typeof END => {
    if (lastMsgHasToolCalls(state)) return "tools_build_fixup";
    onStream({ type: "status", status: "done" });
    return END;
  };

  const routeBuildFixupTools = (
    state: AgentStateType,
  ): "build_fixup_agent" | typeof END => {
    if (stepsSinceFixupStart(state) >= MAX_FIXUP_AGENT_STEPS) {
      onStream({ type: "status", status: "done" });
      return END;
    }
    return "build_fixup_agent";
  };

  const graph = new StateGraph(AgentState)
    .addNode("code_agent", codeAgent)
    .addNode("tools_code", toolNode)
    .addNode("tsc_check", tscCheck, {
      ends: ["tsc_fixup_agent", "build_check"],
    })
    .addNode("tsc_fixup_agent", fixupAgent)
    .addNode("tools_tsc_fixup", toolNode)
    .addNode("build_check", buildCheck, {
      ends: ["build_fixup_agent", END],
    })
    .addNode("build_fixup_agent", fixupAgent)
    .addNode("tools_build_fixup", toolNode)
    .addEdge(START, "code_agent")
    .addConditionalEdges("code_agent", routeCode, ["tools_code", "tsc_check"])
    .addEdge("tools_code", "code_agent")
    .addConditionalEdges("tsc_fixup_agent", routeTscFixup, [
      "tools_tsc_fixup",
      "tsc_check",
    ])
    .addConditionalEdges("tools_tsc_fixup", routeTscFixupTools, [
      "tsc_fixup_agent",
      "tsc_check",
    ])
    .addConditionalEdges("build_fixup_agent", routeBuildFixup, [
      "tools_build_fixup",
      END,
    ])
    .addConditionalEdges("tools_build_fixup", routeBuildFixupTools, [
      "build_fixup_agent",
      END,
    ])
    .compile();

  return graph;
}

export const GRAPH_RECURSION_LIMIT = MAX_CODE_ITERATIONS * 4 + 50;
