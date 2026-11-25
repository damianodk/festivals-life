import React, { useEffect, useState } from "react";
import { animate } from "motion/react";

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  format = (n) => Math.round(n).toLocaleString("pl-PL"),
  className = ""
}) => {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const controls = animate(display, value, {
      duration: 0.65,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(latest)
    });
    return () => controls.stop();
  }, [value]);

  return <span className={`tabular-nums ${className}`}>{format(display)}</span>;
};
