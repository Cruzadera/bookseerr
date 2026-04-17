function formatTimestamp(value, language) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(language || undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getJobStateLabel(job, t) {
  if (job.state === "error") {
    return t("ui.jobs.states.error");
  }

  if (job.state === "imported") {
    return t("ui.jobs.states.completed");
  }

  if (job.state === "downloading") {
    return t("ui.jobs.states.downloading");
  }

  return t("ui.jobs.states.pending");
}

function getJobDescription(job, t) {
  if (job.state === "error") {
    return job.error || t("ui.jobs.fallbackError");
  }

  if (job.state === "imported") {
    return job.destinationLabel
      ? t("ui.jobs.completedWithShelf", { shelf: job.destinationLabel })
      : t("ui.jobs.completed");
  }

  if (job.state === "downloading") {
    return job.destinationLabel
      ? t("ui.jobs.downloadingWithShelf", { shelf: job.destinationLabel })
      : t("ui.jobs.downloading");
  }

  return t("ui.jobs.pending");
}

function getActionLabel(job, t) {
  return job.state === "error"
    ? t("ui.jobs.actions.retry")
    : t("ui.jobs.actions.redownload");
}

function canRestartJob(job) {
  return Boolean(job?.downloadUrl) && ["error", "imported"].includes(job.state);
}

export default function JobsPanel({
  t,
  language,
  jobs,
  jobActionId,
  onRestartJob,
  limit,
}) {
  const visibleJobs = Number.isFinite(limit) ? jobs.slice(0, limit) : jobs;

  return (
    <section className="jobs-panel" aria-labelledby="jobs-panel-title">
      <div className="jobs-panel-header">
        <div>
          <p className="state-panel-kicker">{t("ui.jobs.kicker")}</p>
          <h2 id="jobs-panel-title">{t("ui.jobs.title")}</h2>
        </div>
      </div>

      {!visibleJobs.length ? (
        <div className="state-panel state-panel--empty">
          <div className="state-panel-copy">
            <p className="state-panel-kicker">{t("ui.jobs.emptyKicker")}</p>
            <h2>{t("ui.jobs.emptyTitle")}</h2>
            <p>{t("ui.jobs.emptyDescription")}</p>
          </div>
        </div>
      ) : (
        <div className="jobs-list">
          {visibleJobs.map((job) => {
          const isActionRunning = jobActionId === job.id;
          const isActionable = canRestartJob(job);

          return (
            <article key={job.id} className={`job-card job-card--${job.state || "pending"}`}>
              <div className="job-card-main">
                <div className="job-card-topline">
                  <strong>{job.title}</strong>
                  <span className={`job-state-pill job-state-pill--${job.state || "pending"}`}>
                    {getJobStateLabel(job, t)}
                  </span>
                </div>
                <p className="job-card-copy">{getJobDescription(job, t)}</p>
                <div className="job-card-meta">
                  {job.destinationLabel ? <span>{job.destinationLabel}</span> : null}
                  {job.updatedAt ? <span>{formatTimestamp(job.updatedAt, language)}</span> : null}
                </div>
              </div>

              {isActionable ? (
                <button
                  type="button"
                  className={`secondary${isActionRunning ? " is-loading" : ""}`}
                  disabled={Boolean(jobActionId)}
                  onClick={() => onRestartJob(job)}
                >
                  {getActionLabel(job, t)}
                </button>
              ) : null}
            </article>
          );
          })}
        </div>
      )}
    </section>
  );
}
