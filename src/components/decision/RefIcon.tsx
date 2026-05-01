import { Link2, Github, Figma, FileText, HardDrive, MessageSquare, Layers, BookOpen } from "lucide-react";
import type { RefKind } from "@/lib/decision/references";

interface RefIconProps {
  kind: RefKind;
  className?: string;
  size?: number;
}

export function RefIcon({ kind, className, size = 14 }: RefIconProps) {
  const props = { className, size, strokeWidth: 1.75 } as const;
  switch (kind) {
    case "jira": return <Layers {...props} />;
    case "notion": return <BookOpen {...props} />;
    case "figma": return <Figma {...props} />;
    case "github": return <Github {...props} />;
    case "linear": return <Layers {...props} />;
    case "gdocs": return <FileText {...props} />;
    case "gdrive": return <HardDrive {...props} />;
    case "slack": return <MessageSquare {...props} />;
    case "link":
    default: return <Link2 {...props} />;
  }
}
