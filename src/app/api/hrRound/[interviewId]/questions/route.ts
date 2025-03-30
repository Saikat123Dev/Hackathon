import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Maximum number of follow-up questions allowed per main question
const MAX_FOLLOWUP_QUESTIONS = 2;

export async function GET(
  req: NextRequest,
  { params }: { params: { interviewId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { interviewId } = params;

    // Get query parameters
    const url = new URL(req.url);
    const questionId = url.searchParams.get('questionId');
    const generateFollowUp = url.searchParams.get('generateFollowUp') === 'true';

    // Fetch the HR Interview with questions
    const hrInterview = await db.hRInterview.findUnique({
      where: {
        id: interviewId,

      },
      include: {
        questions: {
          include: {
            followUpQuestions: true,
            userAnswer: true
          }
        }
      }
    });

    if (!hrInterview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    // If a specific question ID is provided, fetch that question with follow-ups
    if (questionId) {
      const question = hrInterview.questions.find(q => q.id === questionId);

      if (!question) {
        return NextResponse.json({ error: "Question not found" }, { status: 404 });
      }

      // If generateFollowUp is true and there are fewer than MAX_FOLLOWUP_QUESTIONS,
      // generate a new follow-up question
      if (generateFollowUp && question.followUpQuestions.length < MAX_FOLLOWUP_QUESTIONS) {
        // We need the user's answer to generate a relevant follow-up
        if (!question.userAnswer) {
          return NextResponse.json({
            error: "Cannot generate follow-up without a user answer"
          }, { status: 400 });
        }

        // Generate a follow-up question with Gemini
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const followUpPrompt = `Generate a follow-up question based on the candidate's answer:

Original Question: ${question.text}
Candidate's Answer: ${question.userAnswer.userAnswer}

Create a probing question that helps the candidate elaborate on their previous response or clarify any points.
The question should be specific to the content of their answer and address areas that could benefit from more detail.
Keep the follow-up question concise and focused.`;

        const followUpResult = await model.generateContent(followUpPrompt);
        const followUpText = followUpResult.response.text();

        // Save the follow-up question
        const followUpQuestion = await db.hRFollowUpQuestion.create({
          data: {
            mainQuestionId: questionId,
            text: followUpText,
            type: "FOLLOWUP",
            category: question.category,
            expectedKeyPoints: [],
            maxScore: Math.floor((question.maxScore ?? 10) * 0.5),
            timeLimit: Math.floor((question.timeLimit ?? 120) * 0.75)
          }
        });

        // Add the new follow-up to the question's follow-ups
        question.followUpQuestions.push(followUpQuestion);
      }

      return NextResponse.json({
        success: true,
        question
      });
    }

    // Otherwise, return all questions with their follow-ups
    return NextResponse.json({
      success: true,
      interview: hrInterview
    });

  } catch (error) {
    console.error("Error fetching HR interview questions:", error);
    return NextResponse.json({
      error: "Failed to fetch questions",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

// Endpoint to generate a follow-up question for a specific question
export async function POST(
  req: NextRequest,
  { params }: { params: { interviewId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { interviewId } = params;
    const { questionId, userAnswer } = await req.json();

    if (!questionId || !userAnswer) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Fetch the question
    const question = await db.hRQuestion.findUnique({
      where: {
        id: questionId,
        hrInterviewId: interviewId
      },
      include: {
        followUpQuestions: true
      }
    });

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Check if we've reached the maximum number of follow-up questions
    if (question.followUpQuestions.length >= MAX_FOLLOWUP_QUESTIONS) {
      return NextResponse.json({
        error: "Maximum number of follow-up questions reached",
        followUpQuestions: question.followUpQuestions
      }, { status: 400 });
    }

    // Generate a follow-up question with Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const followUpPrompt = `Generate a follow-up question based on the candidate's answer:

Original Question: ${question.text}
Candidate's Answer: ${userAnswer}

Create a probing question that helps the candidate elaborate on their previous response or clarify any points.
The question should be specific to the content of their answer and address areas that could benefit from more detail.
Keep the follow-up question concise and focused.`;

    const followUpResult = await model.generateContent(followUpPrompt);
    const followUpText = followUpResult.response.text();

    // Save the follow-up question
    const followUpQuestion = await db.hRFollowUpQuestion.create({
      data: {
        mainQuestionId: questionId,
        text: followUpText,
        type: "FOLLOWUP",
        category: question.category,
        expectedKeyPoints: [],
        maxScore: Math.floor((question.maxScore ?? 10) * 0.5),
        timeLimit: Math.floor((question.timeLimit ?? 120) * 0.75)
      }
    });

    return NextResponse.json({
      success: true,
      followUpQuestion
    });

  } catch (error) {
    console.error("Error generating follow-up question:", error);
    return NextResponse.json({
      error: "Failed to generate follow-up question",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
