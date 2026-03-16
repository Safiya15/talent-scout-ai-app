import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  description?: string;
  className?: string;
  delay?: number;
}

export function StatCard({ title, value, icon, description, className, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className={cn(
        "glass-panel rounded-2xl p-6 relative overflow-hidden group",
        "hover:border-primary/30 hover:shadow-primary/5 transition-all duration-300",
        className
      )}
    >
      <div className="absolute right-0 top-0 p-6 opacity-10 group-hover:opacity-20 group-hover:scale-110 transition-all duration-500 transform origin-top-right">
        {icon}
      </div>
      
      <div className="relative z-10">
        <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
        <h3 className="text-4xl font-display font-bold text-foreground tracking-tight mb-2">
          {value}
        </h3>
        {description && (
          <p className="text-sm text-primary/80 font-medium">{description}</p>
        )}
      </div>
    </motion.div>
  );
}
