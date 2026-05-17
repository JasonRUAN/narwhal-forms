import { HugeiconsIcon, type HugeiconsIconProps } from "@hugeicons/react";

import { cn } from "@/lib/utils";

type IconProps = HugeiconsIconProps & {
  className?: string;
};

export function Icon({
  className,
  size = 20,
  strokeWidth = 1.6,
  ...rest
}: IconProps) {
  return (
    <HugeiconsIcon
      size={size}
      strokeWidth={strokeWidth}
      className={cn("inline-block shrink-0 align-[-2px]", className)}
      {...rest}
    />
  );
}
