import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { interviewId?: string } }
) {
  try {
    const { interviewId } = params;

    if (!interviewId) {
      return NextResponse.json(
        { error: "Interview Id is required" },
        { status: 400 }
      );
    }

    // Fetch all questions for the given interviewId
    const questions = await db.hRQuestion.findMany({
      where: {
        hrInterviewId: interviewId,
      },
      select: {
        id: true,
        text: true,
      },
    });
   console.log(questions);
    // Extract question IDs
    const questionIds = questions.map((q) => q.id);

    // Fetch all user answers related to these questions
    const userAnswers = await db.hRUserAnswer.findMany({
      where: {
        hrQuestionId: { in: questionIds },
      },

      select: {
        hrQuestionId: true,
        userAnswer: true,
        score: true,
      },
    });

    // Map answers to questions
    const response = questions.map((q) => ({
      text: q.text,

      userAnswer: userAnswers.find((ans) => ans.hrQuestionId === q.id)
        ?.userAnswer || null, // If no answer found, return null
    }));

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Error fetching interview answers:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
