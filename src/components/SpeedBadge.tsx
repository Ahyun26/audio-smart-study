import { useEffect, useState } from "react";
import { getSpeechRate, subscribeSpeechRate } from "@/lib/speak";

export function SpeedBadge() {
  const [rate, setRate] = useState<number>(() => getSpeechRate());
  useEffect(() => subscribeSpeechRate(setRate), []);
  return (
    <div
      aria-label={`현재 음성 배속 ${rate.toFixed(1)}배`}
      className="rounded-full border-2 border-border bg-card px-3 py-1 text-base font-bold tabular-nums"
    >
      {rate.toFixed(1)}x
    </div>
  );
}
