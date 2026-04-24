import { serve } from "inngest/next";
import { inngest, functions } from "@crm/jobs";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
