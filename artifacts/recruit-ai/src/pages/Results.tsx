import { useState } from "react";
import { useCandidates } from "@/context/CandidateContext";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CheckCircle2, AlertCircle, XCircle, Search, MessageSquare, 
  ChevronRight, Loader2, Send, Mail, Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGenerateMessage, useSendToSheets } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

// Dialog component inline for simplicity
function MessageDialog({ isOpen, onClose, message, candidateName }: { isOpen: boolean, onClose: () => void, message: string, candidateName: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass-panel w-full max-w-2xl rounded-2xl p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-display font-bold flex items-center gap-2">
            <Mail className="text-primary w-5 h-5" />
            LinkedIn Outreach — {candidateName}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none">✕</button>
        </div>
        <div className="bg-secondary/50 rounded-xl p-6 mb-6 text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed border border-border text-sm">
          {message}
        </div>
        <div className="flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-medium bg-secondary hover:bg-secondary/80 text-foreground transition-colors text-sm"
          >
            Close
          </button>
          <button 
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm"
          >
            {copied ? <><span>✓</span> Copied!</> : <><Send className="w-4 h-4" /> Copy Message</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function Results() {
  const { candidates, updateCandidate } = useCandidates();
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<string>("ALL");
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [dialogData, setDialogData] = useState<{isOpen: boolean, message: string, name: string}>({ isOpen: false, message: "", name: "" });
  
  const { mutateAsync: generateMessage } = useGenerateMessage();
  const { mutateAsync: sendToSheets } = useSendToSheets();
  const { toast } = useToast();

  if (!candidates || candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center mb-6">
          <Users className="w-12 h-12 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-display font-bold mb-2">No Candidates Found</h2>
        <p className="text-muted-foreground mb-8 max-w-md">
          Upload a CSV file to begin the screening process and see results here.
        </p>
        <Link href="/" className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          Upload Data
        </Link>
      </div>
    );
  }

  const filteredCandidates = candidates.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.skills.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === "ALL" || c.status === filter;
    return matchesSearch && matchesFilter;
  });

  const getStatusConfig = (status: string) => {
    switch(status) {
      case 'QUALIFIED': return { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10', border: 'border-success/20' };
      case 'REVIEW': return { icon: AlertCircle, color: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/20' };
      case 'REJECTED': return { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20' };
      default: return { icon: AlertCircle, color: 'text-muted-foreground', bg: 'bg-secondary', border: 'border-border' };
    }
  };

  const handleGenerateMessage = async (candidate: any) => {
    try {
      setGeneratingId(candidate.name);
      
      const res = await generateMessage({
        data: {
          name: candidate.name,
          skills: candidate.skills,
          experience: candidate.experience,
          currentCompany: candidate.currentCompany
        }
      });

      // Update context
      updateCandidate(candidate.name, { message: res.message });
      
      // Auto send to sheets
      await sendToSheets({
        data: {
          name: candidate.name,
          score: candidate.score,
          skills: candidate.skills,
          status: candidate.status,
          message: res.message
        }
      });
      
      toast({
        title: "Success",
        description: "Message generated and synced to Sheets.",
      });

      setDialogData({ isOpen: true, message: res.message, name: candidate.name });

    } catch (error: any) {
      const msg: string = error?.message ?? "";
      const isQuota = msg.includes("quota") || msg.includes("rate") || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED");
      toast({
        title: isQuota ? "Rate Limit Reached" : "Generation Failed",
        description: isQuota
          ? "The AI API rate limit was hit. Please wait a moment and try again."
          : msg || "Could not generate message.",
        variant: "destructive"
      });
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Screening Results</h1>
          <p className="text-muted-foreground mt-1">Review scored candidates and initiate outreach.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Search names or skills..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-secondary/50 border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm transition-all"
            />
          </div>
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="py-2 px-3 rounded-lg bg-secondary/50 border border-border focus:outline-none focus:border-primary text-sm font-medium"
          >
            <option value="ALL">All Status</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="REVIEW">Review</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/30">
                <th className="py-4 px-6 font-medium text-sm text-muted-foreground">Candidate</th>
                <th className="py-4 px-6 font-medium text-sm text-muted-foreground">Key Skills</th>
                <th className="py-4 px-6 font-medium text-sm text-muted-foreground">Score</th>
                <th className="py-4 px-6 font-medium text-sm text-muted-foreground">Status</th>
                <th className="py-4 px-6 font-medium text-sm text-muted-foreground text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              <AnimatePresence>
                {filteredCandidates.map((candidate, i) => {
                  const statusConf = getStatusConfig(candidate.status);
                  const StatusIcon = statusConf.icon;
                  const isGenerating = generatingId === candidate.name;
                  
                  return (
                    <motion.tr 
                      key={candidate.name + i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.2 }}
                      className="hover:bg-secondary/20 transition-colors group"
                    >
                      <td className="py-4 px-6">
                        <p className="font-semibold text-foreground">{candidate.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{candidate.currentCompany} • {candidate.experience}</p>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {candidate.skills.split(',').slice(0,3).map((s, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground border border-border/50 truncate max-w-[100px]">
                              {s.trim()}
                            </span>
                          ))}
                          {candidate.skills.split(',').length > 3 && (
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-transparent text-muted-foreground">
                              +{candidate.skills.split(',').length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center font-display font-bold border border-border">
                            {candidate.score}
                          </div>
                          <div className="flex flex-col text-[10px] text-muted-foreground hidden lg:flex">
                            <span>S:{candidate.skillsScore} E:{candidate.experienceScore}</span>
                            <span>Ed:{candidate.educationScore} L:{candidate.locationScore}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border",
                          statusConf.bg, statusConf.color, statusConf.border
                        )}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {candidate.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        {candidate.status === 'QUALIFIED' ? (
                          candidate.message ? (
                             <button 
                               onClick={() => setDialogData({ isOpen: true, message: candidate.message!, name: candidate.name })}
                               className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-foreground hover:bg-secondary/80 transition-colors border border-border"
                             >
                               <MessageSquare className="w-4 h-4 text-primary" />
                               View Draft
                             </button>
                          ) : (
                            <button 
                              onClick={() => handleGenerateMessage(candidate)}
                              disabled={isGenerating}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors border border-primary/20 hover:border-primary disabled:opacity-50"
                            >
                              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                              Generate Message
                            </button>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground font-medium px-4">
                            No Action
                          </span>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
          
          {filteredCandidates.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              No candidates match your search filters.
            </div>
          )}
        </div>
      </div>

      <MessageDialog 
        isOpen={dialogData.isOpen} 
        onClose={() => setDialogData({ ...dialogData, isOpen: false })} 
        message={dialogData.message}
        candidateName={dialogData.name}
      />
    </div>
  );
}
