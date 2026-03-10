"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const SpinnerLoader = ({
  className,
  size = "default",
}: {
  className?: string;
  size?: "small" | "default" | "large";
}) => {
  const sizeClasses = {
    small: "w-8 h-8",
    default: "w-16 h-16",
    large: "w-24 h-24",
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-xl bg-black/60">
      <motion.div
        className={cn(
          "rounded-full border-4 border-primary/20 border-t-primary",
          sizeClasses[size],
          className
        )}
        animate={{
          rotate: 360,
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </div>
  );
};
