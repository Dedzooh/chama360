import { ROUTES } from "./routes";

export const BOTTOM_NAV = [
  { label: "Home", to: ROUTES.app.home },
  { label: "Pay", to: ROUTES.app.home },
  { label: "Welfare", to: ROUTES.app.home },
  { label: "Activity", to: ROUTES.app.notifications },
  { label: "More", to: ROUTES.more.settings },
] as const;

export const MORE_MENU = [
  { label: "Members", to: ROUTES.app.home },
  { label: "Meetings", to: ROUTES.more.meetings },
  { label: "Voting", to: ROUTES.more.voting },
  { label: "Statements", to: ROUTES.more.reports },
  { label: "Documents", to: ROUTES.more.documents },
  { label: "Reports", to: ROUTES.more.reports },
  { label: "Settings", to: ROUTES.more.settings },
  { label: "Help", to: ROUTES.more.help },
  { label: "Logout", to: ROUTES.auth.login },
] as const;
