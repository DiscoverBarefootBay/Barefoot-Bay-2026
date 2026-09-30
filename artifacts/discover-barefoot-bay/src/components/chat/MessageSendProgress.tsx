import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { isRecentSend, millisecondsUntilNextExpiry } from "./recent-send-progress";

type Job = {
  id: string; messageId: number | null; state: string; createdAt: string; emailRequested: boolean;
  total: number; queued: number; attempted: number; accepted: number;
  failed: number; skipped: number; unknown: number;
};

export function MessageSendProgress() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");
  const [dismissError, setDismissError] = useState("");
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const dismissedIds = useRef(new Set<string>());
  useEffect(() => {
    setJobs([]);
    setError("");
    setDismissError("");
    dismissedIds.current.clear();
    if (!user) return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/messages/send-progress", { credentials: "include" });
        if (!response.ok) throw new Error("Email progress is unavailable. Do not resend an uncertain submission.");
        const data = await response.json();
        if (active) {
          setJobs((data.jobs as Job[]).filter(job => !dismissedIds.current.has(job.id)));
          setNow(Date.now());
          setError("");
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Could not load send progress.");
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 2500);
    window.addEventListener("message-send-progress", refresh);
    const updateClock = () => setNow(Date.now());
    document.addEventListener("visibilitychange", updateClock);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("message-send-progress", refresh);
      document.removeEventListener("visibilitychange", updateClock);
    };
  }, [user?.id]);

  const remaining = millisecondsUntilNextExpiry(jobs, now);
  useEffect(() => {
    if (remaining === null) return;
    const timeout = window.setTimeout(() => setNow(Date.now()), Math.max(1, remaining + 1));
    return () => clearTimeout(timeout);
  }, [remaining]);

  const dismiss = async (job: Job) => {
    if (dismissing || user?.role !== "admin") return;
    setDismissing(job.id);
    setDismissError("");
    try {
      const response = await fetch(`/api/messages/send-progress/${encodeURIComponent(job.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Could not dismiss this progress entry. Please try again.");
      dismissedIds.current.add(job.id);
      setJobs(previous => previous.filter(item => item.id !== job.id));
    } catch (cause) {
      setDismissError(cause instanceof Error ? cause.message : "Could not dismiss this progress entry.");
    } finally {
      setDismissing(null);
    }
  };

  const visibleJobs = jobs.filter(job => isRecentSend(job.createdAt, now));
  if (!visibleJobs.length && !error && !dismissError) return null;
  return (
    <section className="border-b bg-slate-50 p-4 space-y-3" aria-label="Recent message send progress">
      <h2 className="font-semibold">Recent send progress</h2>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {dismissError && <p role="alert" className="text-sm text-red-700">{dismissError}</p>}
      <div className="max-h-72 overflow-y-auto space-y-3" aria-live="polite" aria-atomic="false">
        {visibleJobs.map(job => (
          <div key={job.id} className="relative rounded border bg-white p-3 text-sm">
            {user?.role === "admin" && (
              <button
                type="button"
                aria-label={`Dismiss send progress for ${job.messageId ? `message #${job.messageId}` : "this submission"}`}
                title="Dismiss send progress"
                disabled={dismissing !== null}
                onClick={() => void dismiss(job)}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50"
              >
                <span aria-hidden="true" className="text-lg leading-none">×</span>
              </button>
            )}
            <p className={`font-medium ${user?.role === "admin" ? "pr-8" : ""}`}>
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
      <p className="text-xs text-slate-600">SendGrid acceptance is not guaranteed inbox delivery. Skipped includes opt-outs, invalid addresses and duplicate mailboxes. Status is saved for up to 24 hours after submission unless dismissed.</p>
    </section>
  );
}