import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type LtrTextProps = {
  children: ReactNode;
  className?: string;
  title?: string;
};

export function LtrText({ children, className, title }: LtrTextProps) {
  return (
    <bdi dir="ltr" title={title} className={cn("inline-block text-start font-mono", className)}>
      {children}
    </bdi>
  );
}

export function PhoneText(props: LtrTextProps) {
  return <LtrText {...props} />;
}

export function CodeText(props: LtrTextProps) {
  return <LtrText {...props} />;
}

export function UrlText(props: LtrTextProps) {
  return <LtrText {...props} />;
}

export function IdText(props: LtrTextProps) {
  return <LtrText {...props} />;
}
