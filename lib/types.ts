export type Member = { id: string; name: string; relation: string; phone?: string };
export type Family = { id: string; elderName: string; members: Member[]; createdAt: number; lang?: "en" };

export type Analysis = {
  is_likely_scam: boolean;
  risk: "high" | "medium" | "low";
  scam_type: string;
  claimed_identity: string;
  request: string;
  amount_twd: number | null;
  red_flags: string[];
  verdict_zh: string;
  verdict_en: string;
  message_summary: string;
};

export type CheckStatus = "done" | "waiting" | "confirmed_me" | "confirmed_not_me" | "family_calling";
export type Check = {
  id: string;
  familyId: string;
  createdAt: number;
  analysis: Analysis;
  thumb?: string;
  status: CheckStatus;
  askedMemberId?: string;
  askedName?: string;
  question?: string;
  askKind?: "is_it_you" | "heads_up";
  answeredAt?: number;
};

export type Card =
  | { type: "warning"; title: string; body?: string; en?: string; flags?: string[]; call165?: boolean }
  | { type: "safe"; title: string; body?: string; en?: string; flags?: string[]; call165?: boolean }
  | { type: "waiting"; title: string; body?: string; en?: string; checkId: string }
  | { type: "official"; title: string; body?: string; en?: string; contacts: { label: string; tel?: string }[] };

export type ChatMessage = {
  id: string;
  role: "user" | "abao";
  text?: string;
  imageUrl?: string;
  card?: Card;
  createdAt: number;
};
