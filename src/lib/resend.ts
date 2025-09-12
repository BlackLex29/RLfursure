import { Resend } from "resend";

export const resend = new Resend(
  process.env.RESEND_API_KEY || "re_XfmrqjV1_55KkDuCG6asbwvisy8JLcxAk"
);
