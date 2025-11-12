import { useEffect, Dispatch, SetStateAction } from "react";

export function useDetectBackAction(
  setIsExitDialogOpen: Dispatch<SetStateAction<boolean>>
) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      setIsExitDialogOpen(true);
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [setIsExitDialogOpen]);
}
