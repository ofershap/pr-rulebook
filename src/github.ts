import type { CommentSample } from './types.js';

const API = 'https://api.github.com';
export class GitHubClient {
  constructor(private token: string) {}
  private async request<T>(path: string): Promise<T> {
    const res = await fetch(`${API}${path}`, { headers: {
      Accept: 'application/vnd.github+json', ...(this.token ? {Authorization: `Bearer ${this.token}`} : {}),
      'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'pr-rulebook'
    }});
    if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }
  async collect(repo: string, since: string, maxPrs: number): Promise<{samples: CommentSample[]; prs: number}> {
    type PR = {number:number; merged_at:string|null; user:{login:string;type:string}};
    type ReviewComment = {id:number;body:string;html_url:string;path:string;created_at:string;user:{login:string;type:string}};
    type IssueComment = {id:number;body:string;html_url:string;created_at:string;user:{login:string;type:string}};
    type Commit = {commit:{author:{date:string}|null}};
    const prs = await this.request<PR[]>(`/repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=${Math.min(maxPrs,100)}`);
    const eligible = prs.filter(p => p.merged_at && p.merged_at >= since).slice(0,maxPrs);
    const out: CommentSample[] = [];
    for (const pr of eligible) {
      const [reviews, issues, commits] = await Promise.all([
        this.request<ReviewComment[]>(`/repos/${repo}/pulls/${pr.number}/comments?per_page=100`),
        this.request<IssueComment[]>(`/repos/${repo}/issues/${pr.number}/comments?per_page=100`),
        this.request<Commit[]>(`/repos/${repo}/pulls/${pr.number}/commits?per_page=100`)
      ]);
      const commitDates = commits.map(c => c.commit.author?.date).filter(Boolean) as string[];
      const replies = [...reviews, ...issues];
      for (const c of reviews) {
        if (c.user.type === 'Bot' || /\[bot\]$/.test(c.user.login) || c.body.length < 18) continue;
        const laterCommit = commitDates.some(date => date > c.created_at);
        const rejected = replies.some(r => r.created_at > c.created_at && /\b(won't|wont|disagree|not needed|intentional|as designed)\b/i.test(r.body));
        out.push({ id:c.id, body:c.body.trim(), author:c.user.login, url:c.html_url, path:c.path,
          createdAt:c.created_at, pr:pr.number, accepted:laterCommit && !rejected,
          acceptanceReason: laterCommit ? (rejected ? 'later commit, but a dismissive reply was found' : 'a later commit followed the comment') : 'no later commit signal' });
      }
    }
    return {samples: out, prs: eligible.length};
  }
}
