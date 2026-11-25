import React, { useEffect, useRef } from "react";
import lottie, { type AnimationItem } from "lottie-web";

interface LottieIconProps {
  animationData: object;
  size?: number;
  loop?: boolean;
  className?: string;
}

export const LottieIcon: React.FC<LottieIconProps> = ({
  animationData,
  size = 18,
  loop = true,
  className = ""
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let anim: AnimationItem | null = null;
    try {
      anim = lottie.loadAnimation({
        container: containerRef.current,
        renderer: "svg",
        loop,
        autoplay: true,
        animationData
      });
    } catch (_) {}
    return () => {
      if (anim) anim.destroy();
    };
  }, [animationData, loop]);

  return (
    <div
      ref={containerRef}
      style={{ width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      className={className}
    />
  );
};
