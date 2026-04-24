export { inngest } from "./client";
export * from "./events";

export { classifyOnMessageFn, handleClassifyOnMessage } from "./functions/classify-on-message";
export { firstContactFn, handleFirstContact } from "./functions/first-contact";
export { followupSequenceFn, handleFollowup } from "./functions/followup-sequence";

export const functions = [classifyOnMessageFn, firstContactFn, followupSequenceFn];
