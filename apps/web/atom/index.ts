import { atom } from "jotai";

export const countAtom = atom(0);

/** True while the agent is responding (LLM streaming / connecting). */
export const isAgentBusyAtom = atom(false);

/** True from the moment deploy is clicked until the deployment finishes. */
export const isDeployingAtom = atom(false);
