import JobsPanel from "./JobsPanel";

export default function JobsView({
  t,
  language,
  jobs,
  jobActionId,
  onRestartJob,
}) {
  return (
    <section className="page-view">
      <section className="hero">
        <h1 className="hero-title">Bookseerr</h1>
        <p className="hero-subtitle">{t("ui.jobs.pageSubtitle")}</p>
      </section>

      <section className="panel">
        <JobsPanel
          t={t}
          language={language}
          jobs={jobs}
          jobActionId={jobActionId}
          onRestartJob={onRestartJob}
        />
      </section>
    </section>
  );
}
