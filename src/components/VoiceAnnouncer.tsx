import { useEffect } from "react";
import { speak } from "@/lib/speak";

/**
 * Renders an aria-live region for screen readers AND triggers
 * Web Speech API voice guidance for sighted+voice users.
 */
export function VoiceAnnouncer({ message, speakOnMount = true }: { message: string; speakOnMount?: boolean }) {
  useEffect(() => {
    if (speakOnMount && message) {
      const t = setTimeout(() => speak(message), 300);
      return () => clearTimeout(t);
    }
  }, [message, speakOnMount]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
