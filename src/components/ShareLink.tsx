import { forwardRef } from "react";
import { Link, useLocation, type LinkProps, type Location } from "react-router-dom";

export type ShareRouteState = { shareBackground: Location };

export const ShareLink = forwardRef<HTMLAnchorElement, Omit<LinkProps, "state" | "replace">>(function ShareLink(props, ref) {
  const location = useLocation();
  const state: ShareRouteState = { shareBackground: location };
  return <Link {...props} ref={ref} state={state} />;
});
