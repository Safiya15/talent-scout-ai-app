import { useState, useRef } from "react";
import { useLocation } from "wouter";
import Papa from "papaparse";
import { UploadCloud, FileSpreadsheet, AlertCircle, Loader2, Users, CheckCircle2, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useScoreCandidates } from "@workspace/api-client-react";
import { useCandidates } from "@/context/CandidateContext";
import { StatCard } from "@/components/ui/StatCard";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();
  const { setScoredData, stats } = useCandidates();
  const { toast } = useToast();
  
  const { mutateAsync: scoreCandidates, isPending } = useScoreCandidates();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = (selectedFile: File) => {
    if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a valid CSV file.",
        variant: "destructive"
      });
      return;
    }
    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          // Map to required API format
          const mappedCandidates = results.data.map((row: any) => ({
            name: row.Name || row.name || "Unknown",
            skills: row.Skills || row.skills || "",
            experience: row.Experience || row.experience || "0",
            education: row.Education || row.education || "",
            location: row.Location || row.location || "",
            currentCompany: row['Current Company'] || row.CurrentCompany || row.currentCompany || ""
          })).filter(c => c.name !== "Unknown");

          if (mappedCandidates.length === 0) {
            throw new Error("No valid candidates found in CSV. Check column headers.");
          }

          const response = await scoreCandidates({
            data: { candidates: mappedCandidates }
          });

          setScoredData(response.candidates, response.stats);
          
          toast({
            title: "Analysis Complete",
            description: `Successfully scored ${response.stats.total} candidates.`,
          });
          
          setLocation("/results");
        } catch (error: any) {
          toast({
            title: "Error processing data",
            description: error.message || "Failed to score candidates.",
            variant: "destructive"
          });
        }
      },
      error: (error) => {
        toast({
          title: "Error reading CSV",
          description: error.message,
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="w-full flex flex-col gap-12">
      {/* Hero Section */}
      <section className="text-center max-w-3xl mx-auto mt-8 md:mt-16">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl md:text-6xl font-display font-bold text-gradient mb-6 leading-tight"
        >
          Screen candidates with <br/> <span className="text-gradient-primary">AI precision.</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-lg md:text-xl text-muted-foreground leading-relaxed"
        >
          Upload your LinkedIn CSV export. Our engine scores skills, experience, and education instantly—then drafts personalized outreach for the best fits.
        </motion.p>
      </section>

      {/* Upload Zone */}
      <section className="max-w-2xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className={`
            relative rounded-3xl border-2 border-dashed transition-all duration-300 ease-out overflow-hidden
            ${isDragging ? 'border-primary bg-primary/5' : 'border-border bg-card/30 hover:border-primary/50 hover:bg-card/50'}
            ${file ? 'border-primary/50 bg-card/80' : ''}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="p-12 flex flex-col items-center justify-center text-center relative z-10">
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileSelect}
            />
            
            <AnimatePresence mode="wait">
              {!file ? (
                <motion.div 
                  key="upload"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex flex-col items-center"
                >
                  <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-6 shadow-inner">
                    <UploadCloud className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Upload your CSV</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm">
                    Drag and drop your file here, or click to browse. Expected headers: Name, Skills, Experience, Education...
                  </p>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-3 rounded-xl font-semibold bg-white/5 hover:bg-white/10 text-foreground border border-white/10 transition-colors"
                  >
                    Select File
                  </button>
                </motion.div>
              ) : (
                <motion.div 
                  key="file"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center w-full"
                >
                  <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6 ring-4 ring-primary/10">
                    <FileSpreadsheet className="w-10 h-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-foreground">{file.name}</h3>
                  <p className="text-muted-foreground mb-8">
                    Ready for AI analysis. ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                  
                  <div className="flex gap-4 w-full justify-center">
                    <button 
                      onClick={() => setFile(null)}
                      className="px-6 py-3 rounded-xl font-semibold bg-secondary hover:bg-secondary/80 text-foreground transition-colors"
                      disabled={isPending}
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleAnalyze}
                      disabled={isPending}
                      className="px-8 py-3 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          Run Screening
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Subtle background image from requirements */}
          <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
            <img 
              src={`${import.meta.env.BASE_URL}images/hero-bg.png`} 
              alt="Decorative background" 
              className="w-full h-full object-cover"
            />
          </div>
        </motion.div>
      </section>

      {/* Stats Preview (If existing data) */}
      {stats && (
        <section className="mt-12 border-t border-border pt-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-display font-bold">Previous Analysis</h2>
            <button 
              onClick={() => setLocation('/results')}
              className="text-primary hover:text-primary/80 font-medium text-sm flex items-center gap-1"
            >
              View Full Results →
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard 
              title="Total Candidates" 
              value={stats.total} 
              icon={<Users className="w-8 h-8 text-primary" />} 
              delay={0}
            />
            <StatCard 
              title="Qualified" 
              value={stats.qualified} 
              icon={<CheckCircle2 className="w-8 h-8 text-success" />} 
              delay={0.1}
            />
            <StatCard 
              title="Rejected" 
              value={stats.rejected} 
              icon={<XCircle className="w-8 h-8 text-destructive" />} 
              delay={0.2}
            />
          </div>
        </section>
      )}
    </div>
  );
}
