export type CodeVisibility = "PRIVATE" | "PUBLIC" | "ACCEPTED_ONLY";

export function parseCodeVisibility(value: unknown): CodeVisibility {
    if (value === "PUBLIC" || value === "ACCEPTED_ONLY" || value === "PRIVATE") {
        return value;
    }
    return "PRIVATE";
}

export function canViewCode(params: {
    codeVisibility: string;
    status: string;
    isOwner: boolean;
    isAdmin: boolean;
}) {
    if (params.isOwner || params.isAdmin) return true;
    if (params.codeVisibility === "PUBLIC") return true;
    if (params.codeVisibility === "ACCEPTED_ONLY" && params.status === "ACCEPTED") return true;
    return false;
}

export function getVisibilityLabel(value: string) {
    if (value === "PUBLIC") return "전체공개";
    if (value === "ACCEPTED_ONLY") return "맞았을 때만 공개";
    return "비공개";
}
