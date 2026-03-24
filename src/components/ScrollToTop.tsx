import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === "PUSH" || navigationType === "REPLACE") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [pathname, navigationType]);

  return null;
}
