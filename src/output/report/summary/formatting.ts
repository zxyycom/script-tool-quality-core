export type ReportOptions = {
  footerGeneratedBy: string;
  footerNotice: string;
  nonBlockingNotice: string;
  timeZone: string;
  title: string;
};

export function formatCommitDisplay(sha: string, title: string | null | undefined): string {
  return title ? `\`${sha}\` - ${title}` : `\`${sha}\``;
}

export function formatReportTimestamp(timestamp: string, timeZone: string): string {
  if (typeof timestamp !== "string" || timestamp.length === 0) {
    throw new Error("report timestamp is required");
  }
  if (typeof timeZone !== "string" || timeZone.length === 0) {
    throw new Error("report timeZone is required");
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`invalid report timestamp: ${timestamp}`);
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "longOffset"
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));

  return [
    `${parts.year}-${parts.month}-${parts.day}`,
    `${parts.hour}:${parts.minute}:${parts.second}`,
    `${parts.timeZoneName} (${timeZone}; source ${timestamp})`
  ].join(" ");
}
