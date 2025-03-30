import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

// Enum for Question Types
enum QuestionType {
  MAIN = "MAIN",
  FOLLOWUP = "FOLLOWUP"
}

// Utility Functions
function safeError(error: unknown) {
  return {
    message: error instanceof Error ? error.message : String(error || 'Unknown error'),
    stack: error instanceof Error ? error.stack : undefined
  };
}
// gemeni-flash-2.5-finetune-interview-data//
// Configuration Constants
const CONFIG = {
  AI_MODEL: "gemini-1.5-flash",
  FOLLOWUP_THRESHOLD: 0.5,
  DEFAULT_MAX_SCORE: 10,
  DEFAULT_FOLLOWUP_SCORE_RATIO: 0.5,
  DEFAULT_FOLLOWUP_TIME_RATIO: 0.75
};

// AI Analysis Service
class AIAnalysisService {
  private model: any;

  constructor() {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
    if (!apiKey) {
      throw new Error("Gemini API key is not configured");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: CONFIG.AI_MODEL });
  }

  async analyzeAnswer(params: {
    question: string,
    answer: string,
    maxScore?: number,
    additionalContext?: string
  }) {
    const {
      question,
      answer,
      maxScore = CONFIG.DEFAULT_MAX_SCORE,
      additionalContext = ''
    } = params;

    try {
      const analysisPrompt = `Analyze this interview answer:
Question: ${question}
${additionalContext ? `Context: ${additionalContext}` : ''}
Candidate's Answer: ${answer}

Provide a detailed evaluation with:
- Numerical Score (out of ${maxScore})
- Concise, Constructive Feedback
- Key Points Covered
- Strengths and Areas of Improvement`;

      const result = await this.model.generateContent(analysisPrompt);
      return result.response.text();
    } catch (error) {
      console.error("AI analysis error:", safeError(error));
      return null;
    }
  }

  async generateFollowUpQuestion(params: {
    mainQuestion: string,
    answer: string,
    context?: string
  }) {
    const { mainQuestion, answer, context = '' } = params;

    try {
      const followUpPrompt = `Generate an insightful follow-up question based on the provided details:

Original Question: ${mainQuestion}
Candidate's Answer: ${answer}
${context ? `Additional Context: ${context}` : ''}

Guidelines:
- Ensure the question is specific and thought-provoking.
- Encourage a deeper understanding of the topic.
- Prompt the candidate to provide a more detailed or nuanced explanation.
- Assign an appropriate score to the candidate's answer based on the relevance of the question and context.`;

      const result = await this.model.generateContent(followUpPrompt);
      return result.response.text();
    } catch (error) {
      console.error("Follow-up question generation error:", safeError(error));
      return null;
    }
  }
}

// Analysis Parser
function parseAnalysisResponse(
  analysisText: string | null,
  maxScore: number = CONFIG.DEFAULT_MAX_SCORE
): {
  score: number;
  evaluationFeedback: string;
  matchedKeyPoints: string[];
  voiceTone?: string | null;
  confidence?: string | null;
} {
  if (!analysisText) {
    return {
      score: Math.floor(maxScore / 2),
      evaluationFeedback: 'Unable to generate detailed analysis.',
      matchedKeyPoints: [],
      voiceTone: null,
      confidence: null
    };
  }

  // Regex patterns for extraction
  const extractors = [
    { key: 'score', regex: /Score:\s*(\d+)/i },
    { key: 'evaluationFeedback', regex: /Feedback:\s*([^-]+)/i },
    { key: 'matchedKeyPoints', regex: /Key Points:\s*([^\n]+)/i },
    { key: 'voiceTone', regex: /Voice Tone:\s*([^\n]+)/i },
    { key: 'confidence', regex: /Confidence:\s*([^\n]+)/i }
  ];

  const result: any = {
    score: Math.floor(maxScore / 2),
    evaluationFeedback: 'No specific feedback provided.',
    matchedKeyPoints: [],
    voiceTone: null,
    confidence: null
  };

  extractors.forEach(({ key, regex }) => {
    const match = analysisText.match(regex);
    if (match && match[1]) {
      if (key === 'matchedKeyPoints') {
        result[key] = match[1]
          .split(/,|\n/)
          .map(point => point.trim())
          .filter(Boolean);
      } else if (key === 'score') {
        const parsedScore = parseInt(match[1], 10);
        result[key] = Math.min(parsedScore, maxScore);
      } else {
        result[key] = match[1].trim();
      }
    }
  });

  return result;
}

// Main Interview Handler
export class HRInterviewHandler {
  private aiService: AIAnalysisService;

  constructor() {
    this.aiService = new AIAnalysisService();
  }

  async processMainQuestion(req: NextRequest) {
    try {
      // Authentication
      const authResult = await auth();
      const userId = authResult?.userId;
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Parse request body
      const body = await req.json();
      const { hrQuestionId, userAnswer, videoUrl } = body;
      if (!hrQuestionId || !userAnswer) {
        return NextResponse.json({
          error: "Missing required fields",
          details: "hrQuestionId and userAnswer are required"
        }, { status: 400 });
      }

      // Fetch question with related data
      const hrQuestion = await db.hRQuestion.findUnique({
        where: { id: hrQuestionId },
        include: {
          hrInterview: true,
          followUpQuestions: true,
          userAnswer: true
        }
      });

      if (!hrQuestion) {
        return NextResponse.json({ error: "Question not found" }, { status: 404 });
      }

      // Perform AI Analysis
      const analysisText = await this.aiService.analyzeAnswer({
        question: hrQuestion?.text,
        answer: userAnswer,
        maxScore: hrQuestion?.maxScore || CONFIG.DEFAULT_MAX_SCORE,
        additionalContext: hrQuestion?.hrInterview?.jobDescription
      });

      // Parse AI Analysis
      const analysis = parseAnalysisResponse(
        analysisText,
        hrQuestion.maxScore || CONFIG.DEFAULT_MAX_SCORE
      );

      // Save User Answer
      let hrUserAnswer;
      try {
        // Check if an answer already exists
        const existingAnswer = await db.hRUserAnswer.findFirst({
          where: {
            hrQuestion: {
              id: hrQuestionId
            },
            user: {
              id: userId
            }
          }
        });

        if (existingAnswer) {
          // Update existing answer
          hrUserAnswer = await db.hRUserAnswer.update({
            where: { id: existingAnswer.id },
            data: {
              userAnswer: userAnswer,
              videoUrl: videoUrl ?? null,
              ...analysis,
            },
          });
        } else {
          // Create new answer
          hrUserAnswer = await db.hRUserAnswer.create({
            data: {
                hrQuestionId,
                userId,
                userAnswer,

                ...analysis,
            },
          });
        }
      } catch (error) {
        console.error("Answer saving error:", safeError(error));
        return NextResponse.json({
          error: "Failed to save answer",
          details: safeError(error).message
        }, { status: 500 });
      }

      // Determine Follow-up Eligibility
      const scoreRatio = analysis.score / (hrQuestion.maxScore || CONFIG.DEFAULT_MAX_SCORE);

      // Important change: Always generate a follow-up question, but mark if it's due to a high score
      // or if it's due to a low score (clarification needed)
      const isHighScoreFollowUp = scoreRatio >= CONFIG.FOLLOWUP_THRESHOLD;
      let nextQuestion = null;

      // Check for existing follow-up questions first
      if (hrQuestion.followUpQuestions.length > 0) {
        nextQuestion = hrQuestion.followUpQuestions[0];
      } else {
        // Generate a follow-up question appropriate to the score
        let followUpPrompt;

        if (isHighScoreFollowUp) {
          console.log("I am BATMAN",isHighScoreFollowUp);
          // Deepen understanding for good answers
          followUpPrompt = await this.aiService.generateFollowUpQuestion({
            mainQuestion: hrQuestion.text,
            answer: userAnswer,
            context: `This candidate gave a strong answer. Generate a follow-up question that explores the topic more deeply or tests their knowledge further. Context: ${hrQuestion.hrInterview?.jobDescription || ''}`
          });
        } else {
          // Seek clarification for weaker answers
          followUpPrompt = await this.aiService.generateFollowUpQuestion({
            mainQuestion: hrQuestion.text,
            answer: userAnswer,
            context: `This candidate's answer needs improvement. Generate a follow-up question that gives them a chance to clarify or expand on their answer. Context: ${hrQuestion.hrInterview?.jobDescription || ''}`
          });
        }

        if (followUpPrompt) {
          nextQuestion = await db.hRFollowUpQuestion.create({
            data: {
              mainQuestionId: hrQuestionId,
              text: followUpPrompt,
              type: QuestionType.FOLLOWUP,
              category: hrQuestion.category,
              maxScore: Math.floor((hrQuestion.maxScore || CONFIG.DEFAULT_MAX_SCORE) * CONFIG.DEFAULT_FOLLOWUP_SCORE_RATIO)
            }
          });
        }
      }

      return NextResponse.json({
        success: true,
        hrUserAnswer,
        analysis,
        nextQuestion,
        isEligibleForFollowUp: true // Always eligible, but the nature of follow-up varies
      }, { status: 200 });

    } catch (error) {
      console.error("Main question processing error:", safeError(error));
      return NextResponse.json({
        error: "An unexpected error occurred",
        details: safeError(error).message
      }, { status: 500 });
    }
  }

  async processFollowUpQuestion(req: NextRequest) {
    try {
      // Authentication
      const authResult = await auth();
      const userId = authResult?.userId;
      if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Parse request body
      const body = await req.json();
      const { hrQuestionId, followUpQuestionId, userAnswer, videoUrl } = body;

      // Validate required fields
      if ((!followUpQuestionId && !hrQuestionId) || !userAnswer) {
        return NextResponse.json({
          error: "Missing required fields",
          details: "Either followUpQuestionId or hrQuestionId, and userAnswer are required"
        }, { status: 400 });
      }

      let followUpQuestion;

      // If we have a followUpQuestionId, use it
      if (followUpQuestionId) {
        followUpQuestion = await db.hRFollowUpQuestion.findUnique({
          where: { id: followUpQuestionId },
          include: {
            mainQuestion: {
              include: { hrInterview: true }
            }
          }
        });
      }
      // Otherwise, if we have hrQuestionId, we need to generate a new follow-up on the fly
      else if (hrQuestionId) {
        const mainQuestion = await db.hRQuestion.findUnique({
          where: { id: hrQuestionId },
          include: { hrInterview: true }
        });

        if (!mainQuestion) {
          return NextResponse.json({ error: "Main question not found" }, { status: 404 });
        }

        // Generate a follow-up question
        const generatedFollowUpText = await this.aiService.generateFollowUpQuestion({
          mainQuestion: mainQuestion.text,
          answer: userAnswer,
          context: mainQuestion.hrInterview?.jobDescription
        });

        if (!generatedFollowUpText) {
          return NextResponse.json({ error: "Failed to generate follow-up question" }, { status: 500 });
        }

        // Create the follow-up question in database
        followUpQuestion = await db.hRFollowUpQuestion.create({
          data: {
            mainQuestionId: hrQuestionId,
            text: generatedFollowUpText,
            type: QuestionType.FOLLOWUP,
            category: mainQuestion.category,
            maxScore: Math.floor((mainQuestion.maxScore || CONFIG.DEFAULT_MAX_SCORE) * CONFIG.DEFAULT_FOLLOWUP_SCORE_RATIO)
          },
          include: {
            mainQuestion: {
              include: { hrInterview: true }
            }
          }
        });
      }

      if (!followUpQuestion) {
        return NextResponse.json({ error: "Follow-up question not found or could not be created" }, { status: 404 });
      }

      // Perform AI Analysis
      const analysisText = await this.aiService.analyzeAnswer({
        question: followUpQuestion.text,
        answer: userAnswer,
        maxScore: followUpQuestion.maxScore,
        additionalContext: followUpQuestion.mainQuestion.hrInterview?.jobDescription
      });

      // Parse AI Analysis
      const analysis = parseAnalysisResponse(
        analysisText,
        followUpQuestion.maxScore || CONFIG.DEFAULT_MAX_SCORE
      );

      // Save Follow-up Answer
      let hrUserAnswer;
      try {
        // Check for existing answer first
        console.log("followUpQuestion.id", followUpQuestion.id);
        const existingAnswer = await db.hRUserAnswer.findFirst({
          where: {
            followup: {
              id: followUpQuestion.id
            },
            user: {
              id: userId
            }
          }
        });
        console.log("existingAnswer", existingAnswer);

        hrUserAnswer = await db.hRUserAnswer.upsert({
          where: { hrQuestionId: followUpQuestion.mainQuestion.id },
          update: {
            userAnswer: userAnswer,
            videoUrl: videoUrl || null,
            ...analysis
          },
          create: {
            followup: { connect: { id: followUpQuestion.id } },
            hrQuestion: { connect: { id: followUpQuestion.mainQuestion.id } },
            user: { connect: { id: userId } },
            userAnswer: userAnswer,
            videoUrl: videoUrl || null,
            ...analysis
          }
        });
      } catch (error) {
        console.error("Follow-up answer saving error:", safeError(error));
        return NextResponse.json({
          error: "Failed to save follow-up answer",
          details: safeError(error).message
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        hrUserAnswer,
        analysis,
        followUpQuestion
      }, { status: 200 });

    } catch (error) {
      console.error("Follow-up question processing error:", safeError(error));
      return NextResponse.json({
        error: "An unexpected error occurred",
        details: safeError(error).message
      }, { status: 500 });
    }
  }
}
// Route Handlers
const handler = new HRInterviewHandler();

export async function POST(req: NextRequest) {
  return handler.processMainQuestion(req);
}

export async function PUT(req: NextRequest) {
  return handler.processFollowUpQuestion(req);
}
