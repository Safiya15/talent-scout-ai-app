import { useCandidates } from "@/context/CandidateContext";
import { Link } from "wouter";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Clock, TrendingUp, Users, Target } from "lucide-react";
import { motion } from "framer-motion";
import { formatTime } from "@/lib/utils";

export default function Pipeline() {
  const { stats } = useCandidates();

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center mb-6">
          <TrendingUp className="w-12 h-12 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-display font-bold mb-2">No Data Available</h2>
        <p className="text-muted-foreground mb-8 max-w-md">
          Upload and score candidates first to view your recruitment pipeline analytics.
        </p>
        <Link href="/" className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          Go to Dashboard
        </Link>
      </div>
    );
  }

  const pieData = [
    { name: 'Qualified', value: stats.qualified, color: 'hsl(var(--success))' },
    { name: 'Review', value: stats.review, color: 'hsl(var(--warning))' },
    { name: 'Rejected', value: stats.rejected, color: 'hsl(var(--destructive))' },
  ].filter(d => d.value > 0);

  const conversionRate = stats.total > 0 ? Math.round((stats.qualified / stats.total) * 100) : 0;

  return (
    <div className="w-full flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Pipeline Analytics</h1>
        <p className="text-muted-foreground mt-1">Overview of your current candidate funnel.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 glass-panel rounded-2xl p-6 md:p-8 flex flex-col"
        >
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Candidate Distribution
          </h3>
          <div className="flex-1 min-h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Side Metrics */}
        <div className="flex flex-col gap-6">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-panel rounded-2xl p-6 bg-gradient-to-br from-primary/10 to-transparent border-primary/20"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4">
              <Clock className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Estimated Time Saved</p>
            <h3 className="text-4xl font-display font-bold text-foreground mb-2">
              {formatTime(stats.timeSavedMinutes)}
            </h3>
            <p className="text-xs text-muted-foreground">Based on 15 mins manual review per candidate</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-panel rounded-2xl p-6"
          >
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Conversion Rate</p>
            <h3 className="text-4xl font-display font-bold text-foreground mb-2">
              {conversionRate}%
            </h3>
            <p className="text-xs text-muted-foreground">Qualified out of {stats.total} total candidates</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
