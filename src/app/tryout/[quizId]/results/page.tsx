"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

interface Result {
  quizId: string;
  nickname: string;
  correctAnswers: number;
  totalQuestions: number;
  timestamp: number;
}

export default function TryoutResultsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { quizId } = useParams();
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const nickname = localStorage.getItem("nickname");
    if (!nickname) {
      router.push("/");
      return;
    }
    const storedResult = localStorage.getItem(`tryoutResult_${quizId}_${nickname}`);
    if (storedResult) {
      setResult(JSON.parse(storedResult));
    } else {
      router.push("/quiz-select-tryout");
    }
  }, [quizId, router]);

  if (!result) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-red-500 font-mono text-xl animate-pulse"
        >
          {t("loading")}
        </motion.div>
      </div>
    );
  }

  const percentage = ((result.correctAnswers / result.totalQuestions) * 100).toFixed(2);

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-red-950/15 via-black to-purple-950/15" style={{ opacity: 0.3 }} />
      <div className="relative z-10 container mx-auto px-4 pt-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <h1
            className="text-4xl md:text-6xl font-bold font-mono tracking-wider text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)] animate-pulse"
            style={{ textShadow: "0 0 10px rgba(239, 68, 68, 0.7)" }}
          >
            {t("resultsTitle")}
          </h1>
        </motion.div>
        <Card className="max-w-2xl mx-auto bg-gray-900/90 border-red-900/50 backdrop-blur-sm p-8">
          <div className="text-center">
            <h2 className="text-2xl font-mono text-white mb-4">
              {t("resultsSummary", { nickname: result.nickname })}
            </h2>
            <p className="text-lg text-white font-mono mb-2">
              {t("score", { correct: result.correctAnswers, total: result.totalQuestions })}
            </p>
            <p className="text-lg text-white font-mono mb-6">
              {t("percentage", { percentage })}
            </p>
            <Button
              onClick={() => router.push("/quiz-select-tryout")}
              className="bg-red-800 text-white border-red-600 font-mono"
            >
              {t("backToQuizSelect")}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}