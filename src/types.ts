export interface CommentSample {
  id: number; body: string; author: string; url: string; path: string;
  createdAt: string; pr: number; accepted: boolean; acceptanceReason: string;
}
export interface Rule {
  id: string; title: string; instruction: string; confidence: number;
  occurrences: number; accepted: number; distinctPrs: number; files: string[]; examples: CommentSample[];
}
export interface ScanResult {
  repository: string; since: string; generatedAt: string; prsScanned: number;
  commentsScanned: number; rules: Rule[]; caveats: string[];
}
