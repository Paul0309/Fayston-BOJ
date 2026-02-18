export type SupportedLanguage = "cpp" | "python" | "javascript" | "java";

export const LANGUAGE_META: Record<SupportedLanguage, { label: string; monaco: string; defaultCode: string }> = {
    cpp: {
        label: "C++17",
        monaco: "cpp",
        defaultCode: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    // Write your code here.\n\n    return 0;\n}\n"
    },
    python: {
        label: "Python 3",
        monaco: "python",
        defaultCode: "import sys\n\n# Write your code here.\nprint('Hello World!')\n"
    },
    javascript: {
        label: "Node.js",
        monaco: "javascript",
        defaultCode: "function main() {\n  // Write your code here.\n  console.log('Hello World!');\n}\nmain();\n"
    },
    java: {
        label: "Java 11",
        monaco: "java",
        defaultCode: "public class Main {\n    public static void main(String[] args) {\n        // Write your code here.\n        System.out.println(\"Hello World!\");\n    }\n}\n"
    }
};

export const DEFAULT_ALLOWED_LANGUAGES: SupportedLanguage[] = ["python", "javascript", "java", "cpp"];

export function isSupportedLanguage(value: string): value is SupportedLanguage {
    return value in LANGUAGE_META;
}
