import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

export const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  fixupAttempt: Annotation<number>({
    reducer: (_, b) => b,
    default: () => 0,
  }),
});

export type AgentStateType = typeof AgentState.State;
