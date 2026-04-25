import { classifyOnMessageFn, handleClassifyOnMessage } from "./functions/classify-on-message";
import { firstContactFn, handleFirstContact } from "./functions/first-contact";
import { followupSequenceFn, handleFollowup } from "./functions/followup-sequence";
import { autoAssignLeadFn, reAssignHotLeadFn, handleAutoAssign, handleReAssignHot } from "./functions/auto-assign";

export { inngest } from "./client";
export * from "./events";

export { classifyOnMessageFn, handleClassifyOnMessage };
export { firstContactFn, handleFirstContact };
export { followupSequenceFn, handleFollowup };
export { autoAssignLeadFn, reAssignHotLeadFn, handleAutoAssign, handleReAssignHot };

export const functions = [
  classifyOnMessageFn,
  firstContactFn,
  followupSequenceFn,
  autoAssignLeadFn,
  reAssignHotLeadFn,
];
