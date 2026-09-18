"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useSound } from "./sound-provider";
import type { Voice } from "@/lib/sound";

type Props = ComponentProps<typeof Link> & { voice?: Voice };

/**
 * 移動のたびに、紙を繰る音がする。
 * 押せるものの印（tap）もここで付ける。釦や札は自分の手応えを持つが、字だけの戸口はこれで沈む。
 */
export function PaperLink({ voice = "turn", onClick, className, ...props }: Props) {
  const { play } = useSound();

  return (
    <Link
      {...props}
      className={className ? `tap ${className}` : "tap"}
      onClick={(event) => {
        play(voice);
        onClick?.(event);
      }}
    />
  );
}
