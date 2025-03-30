import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { QuestionType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY!);

// Helper function to extract JSON from response
function extractJSON(response: string): any {
  const jsonMatch = response.match(/\{[\s\S]*\}/); // Extract the JSON block
  if (!jsonMatch) {
    throw new Error("No valid JSON found in response");
  }

  try {
    return JSON.parse(jsonMatch[0]); // Parse extracted JSON
  } catch (error) {
    console.error("JSON Parsing Error:", error);
    throw new Error("Failed to parse JSON response");
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requestBody = await req.json();
    console.log("Request Body:", JSON.stringify(requestBody, null, 2));
    const resumeurl = await db.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        resume: true,
      },
    });

    if(!resumeurl){
      return NextResponse.json({
        error: "No resume found",
      }, { status: 400 });
    }
    // Validate required fields
    const requiredFields = ['jobPosition', 'jobDescription', 'jobExperience', 'difficultyLevel', 'totalQuestions'];
    const missingFields = requiredFields.filter(field => !requestBody[field]);

    if (missingFields.length > 0) {
      return NextResponse.json({
        error: "Missing required fields",
        missingFields
      }, { status: 400 });
    }

    const {
      jobPosition,
      jobDescription,
      skills,
      jobExperience,
      difficultyLevel,
      totalQuestions,
      resumeUrl
    } = requestBody;

    // Generate questions with Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Generate ${totalQuestions} professional HR interview questions for a ${jobPosition} role with resume detaails as ${resumeurl}:

Format STRICTLY as JSON with the following structure:
{
  "questions": [
    {
      "text": "Main question text",
      "category": "Behavioral|Technical|Situational|Cultural Fit",
      "expectedKeyPoints": [
        "Key point 1 to evaluate in the answer",
        "Key point 2 to evaluate in the answer"
      ],
      "maxScore": 10,
      "timeLimit": 120,
      "followUpQuestions": [
        {
          "text": "Follow-up question 1",
          "expectedKeyPoints": [
            "Key point for follow-up"
          ],
          "maxScore": 5,
          "timeLimit": 90
        }
      ]
    }
  ]
}

Context Details:
- Job Position: ${jobPosition}
- Experience Level: ${jobExperience} years
- Resume  : ${resumeurl}
- Job Description: ${jobDescription}
- Required Skills: ${skills?.join(", ") || "Not specified"}
- Difficulty Level: ${difficultyLevel}

Guidelines:
1. Generate exactly ${totalQuestions} questions
2. Questions should be relevant to the job position and experience level
3. Include a mix of technical, behavioral, and situational questions
4. Each main question should have 2-3 expected key points
5. Include meaningful follow-up questions where appropriate
6. Ensure questions are professional and job-specific
7. Ensure the 30% questions are from Resume.
`;


    const result = await model.generateContent(prompt);
    const questionsResponse = result.response.text();
    console.log("Raw Questions Response:", questionsResponse);

    // Parse questions from JSON response
    let parsedQuestions;
    try {
      const parsedResponse = extractJSON(questionsResponse);
      console.log(JSON.stringify(parsedResponse, null, 2));

      parsedQuestions = parsedResponse.questions;
    } catch (parseError) {
      console.error("Error parsing JSON response:", parseError);
      return NextResponse.json({
        error: "Failed to parse AI response",
        rawResponse: questionsResponse
      }, { status: 400 });
    }

    if (!parsedQuestions || parsedQuestions.length === 0) {
      return NextResponse.json({
        error: "No valid questions could be parsed from the AI response",
        rawResponse: questionsResponse
      }, { status: 400 });
    }

    // Create HR Interview
    const hrInterview = await db.hRInterview.create({
      data: {
        userId,
        jobPosition,
        jobDescription,
        jobExperience: String(jobExperience),
        skills: skills || [],
        difficultyLevel,
        resumeUrl
      }
    });

    // Create main questions
    const mainQuestions: Array<any> = [];
    for (const question of parsedQuestions) {
      const mainQuestion = await db.hRQuestion.create({
        data: {
          hrInterviewId: hrInterview.id,
          text: question.text,
          type: "MAIN" as QuestionType,
          category: question.category || "General",
          expectedKeyPoints: question.expectedKeyPoints || [],
          maxScore: question.maxScore || 10,
          timeLimit: question.timeLimit || 120,
        }
      });

      mainQuestions.push(mainQuestion);

      // Create follow-up questions if any
      if (question.followUpQuestions && question.followUpQuestions.length > 0) {
        for (const followUp of question.followUpQuestions) {
          await db.hRFollowUpQuestion.create({
            data: {
              mainQuestionId: mainQuestion.id,
              text: followUp.text,
              type: "FOLLOWUP" as QuestionType,
              category: question.category || "General",
              expectedKeyPoints: followUp.expectedKeyPoints || [],
              maxScore: followUp.maxScore || 5,
              timeLimit: followUp.timeLimit || 90
            }
          });
        }
      }
    }

    // Fetch the complete interview with questions and follow-ups
    const completeInterview = await db.hRInterview.findUnique({
      where: { id: hrInterview.id },
      include: {
        questions: {
          include: {
            followUpQuestions: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      hrInterview: completeInterview
    }, { status: 201 });

  } catch (error) {
    console.error("Error creating HR interview:", error);
    return NextResponse.json({
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
