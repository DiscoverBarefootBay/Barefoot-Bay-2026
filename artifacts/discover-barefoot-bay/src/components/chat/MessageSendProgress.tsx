import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";

type Job = {
  id: string; messageId: number | null; state: string; createdAt: string; emailRequested: boolean;
  total: number; queued: number; attempted: number; accepted: number;
  failed: number; skipped: number; unknown: number;
};

export function MessageSendProgress() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    setJobs([]);
    setError("");
    if (!user) return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/messages/send-progress", { credentials: "include" });
        if (!response.ok) throw new Error("Email progress is unavailable. Do not resend an uncertain submission.");
        const data = await response.json();
        if (active) { setJobs(data.jobs); setError(""); }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Could not load send progress.");
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 2500);
    window.addEventListener("message-send-progress", refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener("message-send-progress", refresh); };
  }, [user?.id]);
  if (!jobs.length && !error) return null;
  return (
    <section className="border-b bg-slate-50 p-4 space-y-3" aria-label="Recent message send progress">
      <h2 className="font-semibold">Recent send progress</h2>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="max-h-72 overflow-y-auto space-y-3" aria-live="polite" aria-atomic="false">
        {jobs.map(job => (
          <div key={job.id} className="rounded border bg-white p-3 text-sm">
            <p className="font-medium">
              {job.messageId ? `In-site message #${job.messageId} created.` : "Message creation not yet confirmed."}
              {" "}{job.state === "sending" ? "Email sending in progress…" :
                job.state === "preparing" ? "Preparing submission…" :
                job.state === "complete" ? (job.total ? job.failed || job.unknown ? "Email processing finished with failures or uncertain outcomes." : "Email processing finished." : job.emailRequested ? "No eligible email recipients." : "Email was not requested.") :
                job.state === "interrupted" ? "Submission interrupted; do not resend." :
                "Submission needs attention; do not resend without checking the message."}
            </p>
            <p>{job.queued} queued · {job.attempted} attempted · {job.accepted} accepted by SendGrid · {job.failed} failed · {job.skipped} skipped · {job.total} eligible mailboxes (including sender copy)</p>
            {job.unknown > 0 && <p className="text-amber-800">{job.unknown} outcome unknown. Not retried to prevent duplicates.</p>}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-600">SendGrid acceptance is not guaranteed inbox delivery. Skipped includes opt-outs, invalid addresses and duplicate mailboxes. Status is saved and remains available after refresh.</p>
    </section>
  );
}