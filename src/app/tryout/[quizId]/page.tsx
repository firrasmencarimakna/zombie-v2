"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import QuizPhase from "@/components/tryout/QuizPhase";
import { motion } from "framer-motion";

export default function TryoutPage() {
  const router = useRouter();
  const { quizId } = useParams();
  const [nickname, setNickname] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch nickname from localStorage only on the client
    const storedNickname = localStorage.getItem("nickname");
    setNickname(storedNickname);
    setIsLoading(false);

    // Redirect to home if no nickname is found
    if (!storedNickname) {
      router.push("/");
    }
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-red-500 font-mono text-xl animate-pulse"
        > 
          Loading...
        </motion.div>
      </div>
    );
  }

  if (!nickname) {
    return null; // Render nothing while redirecting
  }

  return <QuizPhase quizId={quizId as string} nickname={nickname} />;
}