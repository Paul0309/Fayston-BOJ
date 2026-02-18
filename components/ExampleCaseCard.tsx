"use client";

import { useState } from "react";

interface ExampleCaseCardProps {
  index: number;
  groupName: string;
  score: number;
  input: string;
  output: string;
}

function buildCaseDescription(groupName: string, input: string, output: string, score: number) {
  const name = groupName.toLowerCase();
  if (name.includes("sample")) {
    return `기본 입출력 형식을 확인하는 예제입니다. (${score}점 반영 그룹)`;
  }
  if (name.includes("edge") || name.includes("bound")) {
    return `경계 조건을 확인하기 위한 예제입니다. (${score}점 반영 그룹)`;
  }
  const inputLines = input.split(/\r?\n/).filter((v) => v.length > 0).length;
  const outputLines = output.split(/\r?\n/).filter((v) => v.length > 0).length;
  return `입력 ${inputLines}줄, 출력 ${outputLines}줄로 구성된 검증 예제입니다. (${score}점 반영 그룹)`;
}

export default function ExampleCaseCard({
  index,
  groupName,
  score,
  input,
  output
}: ExampleCaseCardProps) {
  const [copied, setCopied] = useState<"" | "input" | "output">("");
  const caseDescription = buildCaseDescription(groupName, input, output, score);

  const copyText = async (type: "input" | "output", text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(type);
      setTimeout(() => setCopied(""), 1200);
    } catch {
      setCopied("");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="font-medium text-neutral-200">
            예제 입력 {index + 1}
            <span className="ml-2 text-xs text-neutral-300">
              ({groupName}, {score}점)
            </span>
          </h3>
          <button
            type="button"
            onClick={() => copyText("input", input)}
            className="rounded border border-neutral-600 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
          >
            {copied === "input" ? "복사됨" : "복사"}
          </button>
        </div>
        <pre className="boj-code-font bg-neutral-800 p-4 rounded-md text-sm overflow-x-auto border border-neutral-700 whitespace-pre-wrap break-words">
          {input}
        </pre>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="font-medium text-neutral-200">예제 출력 {index + 1}</h3>
          <button
            type="button"
            onClick={() => copyText("output", output)}
            className="rounded border border-neutral-600 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
          >
            {copied === "output" ? "복사됨" : "복사"}
          </button>
        </div>
        <pre className="boj-code-font bg-neutral-800 p-4 rounded-md text-sm overflow-x-auto border border-neutral-700 whitespace-pre-wrap break-words">
          {output}
        </pre>
      </div>
      <p className="text-xs text-neutral-400 leading-relaxed">{caseDescription}</p>
    </div>
  );
}
