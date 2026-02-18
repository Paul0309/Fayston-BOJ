"use client";

import { useState } from "react";
import { Clock, RefreshCw } from "lucide-react";

type ScheduleType = "AI_REVIEW" | "AUTO_PROBLEM_GEN";

interface ScheduleConfig {
  type: ScheduleType;
  enabled: boolean;
  presetLabel: string;
  cronExpression: string;
  lastRunAt?: string;
  nextRunAt?: string;
}

const PRESET_OPTIONS: Record<string, { label: string; cron: string; description: string }> = {
  hourly: {
    label: "매시간",
    cron: "0 * * * *",
    description: "매 정각에 실행"
  },
  every6hours: {
    label: "6시간마다",
    cron: "0 */6 * * *",
    description: "00시, 06시, 12시, 18시"
  },
  daily2am: {
    label: "매일 새벽 2시",
    cron: "0 2 * * *",
    description: "매일 오전 2시에 실행"
  },
  daily10am: {
    label: "매일 오전 10시",
    cron: "0 10 * * *",
    description: "매일 아침 10시에 실행"
  },
  weekly: {
    label: "주 1회 (월요일 2시)",
    cron: "0 2 * * 1",
    description: "매주 월요일 오전 2시"
  }
};

export default function AdminAutomationSettings() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [aiReviewSchedule, setAiReviewSchedule] = useState<ScheduleConfig>({
    type: "AI_REVIEW",
    enabled: true,
    presetLabel: "every6hours",
    cronExpression: "0 */6 * * *",
  });

  const [problemGenSchedule, setProblemGenSchedule] = useState<ScheduleConfig>({
    type: "AUTO_PROBLEM_GEN",
    enabled: false,
    presetLabel: "daily10am",
    cronExpression: "0 10 * * *",
  });

  const [useCustomCron, setUseCustomCron] = useState(false);

  const handleScheduleChange = (
    schedule: ScheduleConfig,
    updates: Partial<ScheduleConfig>,
    setter: (s: ScheduleConfig) => void
  ) => {
    setter({ ...schedule, ...updates });
  };

  const handlePresetSelect = (
    presetKey: string,
    schedule: ScheduleConfig,
    setter: (s: ScheduleConfig) => void
  ) => {
    const preset = PRESET_OPTIONS[presetKey];
    if (preset) {
      setter({
        ...schedule,
        presetLabel: presetKey,
        cronExpression: preset.cron,
      });
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/automation/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedules: [aiReviewSchedule, problemGenSchedule],
        }),
      });

      if (!response.ok) {
        setError(await response.text());
        return;
      }

      setMessage("스케줄 설정이 저장되었습니다!");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 중 오류 발생");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-neutral-100 flex items-center gap-2">
          <RefreshCw className="w-6 h-6" />
          자동화 스케줄 설정
        </h2>
        <p className="text-sm text-neutral-400 mt-1">
          AI 리뷰와 문제 자동 생성의 실행 시간을 설정합니다.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 p-3 text-sm text-emerald-200">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Review Schedule */}
        <ScheduleCard
          title="AI 문제 설명 리뷰"
          description="문제의 LaTeX/마크다운 오류를 자동으로 탐지합니다."
          schedule={aiReviewSchedule}
          onScheduleChange={(updates) =>
            handleScheduleChange(aiReviewSchedule, updates, setAiReviewSchedule)
          }
          onPresetSelect={(preset) =>
            handlePresetSelect(preset, aiReviewSchedule, setAiReviewSchedule)
          }
          useCustomCron={useCustomCron}
          onCustomCronToggle={setUseCustomCron}
        />

        {/* Problem Auto-Generation Schedule */}
        <ScheduleCard
          title="AI 자동 문제 생성"
          description="기존 문제를 기반으로 새 변형 문제를 자동 생성합니다."
          schedule={problemGenSchedule}
          onScheduleChange={(updates) =>
            handleScheduleChange(problemGenSchedule, updates, setProblemGenSchedule)
          }
          onPresetSelect={(preset) =>
            handlePresetSelect(preset, problemGenSchedule, setProblemGenSchedule)
          }
          useCustomCron={useCustomCron}
          onCustomCronToggle={setUseCustomCron}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition"
        >
          {loading ? "저장 중..." : "스케줄 저장"}
        </button>
      </div>
    </div>
  );
}

interface ScheduleCardProps {
  title: string;
  description: string;
  schedule: ScheduleConfig;
  onScheduleChange: (updates: Partial<ScheduleConfig>) => void;
  onPresetSelect: (key: string) => void;
  useCustomCron: boolean;
  onCustomCronToggle: (value: boolean) => void;
}

function ScheduleCard({
  title,
  description,
  schedule,
  onScheduleChange,
  onPresetSelect,
  useCustomCron,
  onCustomCronToggle,
}: ScheduleCardProps) {
  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-neutral-100">{title}</h3>
          <p className="text-sm text-neutral-400 mt-1">{description}</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={schedule.enabled}
            onChange={(e) => onScheduleChange({ enabled: e.target.checked })}
            className="w-4 h-4 rounded"
          />
          <span className="text-sm text-neutral-300">활성화</span>
        </label>
      </div>

      <div className="space-y-4">
        {/* Preset Selection */}
        <div>
          <label className="block text-sm font-medium text-neutral-200 mb-2">
            <Clock className="w-4 h-4 inline mr-1" />
            {useCustomCron ? "커스텀 설정" : "프리셋"}
          </label>

          {!useCustomCron ? (
            <div className="space-y-2">
              {Object.entries(PRESET_OPTIONS).map(([key, preset]) => (
                <label
                  key={key}
                  className="flex items-start gap-3 p-2 rounded cursor-pointer hover:bg-neutral-800 transition"
                >
                  <input
                    type="radio"
                    name={`preset-${schedule.type}`}
                    checked={schedule.presetLabel === key}
                    onChange={() => onPresetSelect(key)}
                    className="w-4 h-4 mt-0.5 rounded-full"
                  />
                  <div>
                    <div className="text-sm font-medium text-neutral-200">{preset.label}</div>
                    <div className="text-xs text-neutral-400">{preset.description}</div>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <input
              type="text"
              value={schedule.cronExpression}
              onChange={(e) => onScheduleChange({ cronExpression: e.target.value })}
              placeholder="0 */6 * * * (cron 형식)"
              className="w-full rounded border border-neutral-600 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 outline-none"
            />
          )}

          <button
            onClick={() => onCustomCronToggle(!useCustomCron)}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300"
          >
            {useCustomCron ? "프리셋으로 돌아가기" : "커스텀 Cron 입력"}
          </button>
        </div>

        {/* Info */}
        {schedule.lastRunAt && (
          <div className="text-xs text-neutral-400 space-y-1">
            <div>마지막 실행: {new Date(schedule.lastRunAt).toLocaleString("ko-KR")}</div>
          </div>
        )}
      </div>
    </div>
  );
}
