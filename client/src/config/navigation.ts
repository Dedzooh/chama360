import { ROUTES } from "./routes";

export const BOTTOM_NAV = [
  { label: "Home", to: ROUTES.app.home },
  { label: "Members", to: ROUTES.chama.members("active") },
  { label: "Finance", to: ROUTES.chama.contributions("active") },
  { label: "Welfare", to: ROUTES.chama.welfare("active") },
  { label: "More", to: ROUTES.more.settings },
] as const;

export const MORE_MENU = [
  { label: "Meetings", to: ROUTES.more.meetings },
  { label: "Reports", to: ROUTES.more.reports },
  { label: "Documents", to: ROUTES.more.documents },
  { label: "Voting", to: ROUTES.more.voting },
  { label: "Settings", to: ROUTES.more.settings },
  { label: "Admin Portal", to: ROUTES.admin.home },
  { label: "Mobile Tools", to: ROUTES.app.mobile },
  { label: "M-Pesa Admin", to: ROUTES.admin.mpesa },
  { label: "Audit Logs", to: ROUTES.more.auditLogs },
  { label: "Help", to: ROUTES.more.help },
] as const;
