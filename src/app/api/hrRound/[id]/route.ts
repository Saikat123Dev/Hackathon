// API route for follow-up questions
// File: app/api/hr-followup-questions/[followupId]/route.ts

import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: { followupId?: string } }) {
  try {
    const { userId } =await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { followupId } = params;

    if (followupId) {
      // Fetch a specific follow-up question
      const followUp = await db.hRFollowUpQuestion.findUnique({
        where: { id: followupId },
        include: {
          mainQuestion: {
            include: {
              hrInterview: {
                select: {
                  userId: true
                }
              }
            }
          },
          HRUserAnswer: true
        }
      });

      if (!followUp) {
        return NextResponse.json({ error: "Follow-up question not found" }, { status: 404 });
      }

      // Check if the user owns this question
      if (followUp.mainQuestion.hrInterview.userId !== userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      return NextResponse.json(followUp);
    } else {
      // If no follow-up ID is provided, require a main question ID
      const url = new URL(req.url);
      const mainQuestionId = url.searchParams.get("mainQuestionId");

      if (!mainQuestionId) {
        return NextResponse.json({ error: "Main question ID is required" }, { status: 400 });
      }

      // First verify the user owns this question via the interview
      const mainQuestion = await db.hRQuestion.findUnique({
        where: { id: mainQuestionId },
        include: {
          hrInterview: {
            select: {
              userId: true
            }
          }
        }
      });

      if (!mainQuestion) {
        return NextResponse.json({ error: "Main question not found" }, { status: 404 });
      }

      if (mainQuestion.hrInterview.userId !== userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Fetch all follow-up questions for the main question
      const followUps = await db.hRFollowUpQuestion.findMany({
        where: { mainQuestionId },
        include: {
          HRUserAnswer: true
        }
      });

      return NextResponse.json(followUps);
    }
  } catch (error) {
    console.error("Error retrieving follow-up questions:", error);
    return NextResponse.json({ error: "Failed to retrieve follow-up questions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      mainQuestionId,
      text,
      category,
      expectedKeyPoints,
      maxScore,
      timeLimit
    } = body;

    // Verify the user owns this question via the interview
    const mainQuestion = await db.hRQuestion.findUnique({
      where: { id: mainQuestionId },
      include: {
        hrInterview: {
          select: {
            userId: true
          }
        }
      }
    });

    if (!mainQuestion) {
      return NextResponse.json({ error: "Main question not found" }, { status: 404 });
    }

    if (mainQuestion.hrInterview.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Create a new follow-up question
    const newFollowUp = await db.hRFollowUpQuestion.create({
      data: {
        mainQuestionId,
        text,
        type: "FOLLOWUP",
        category,
        expectedKeyPoints,
        maxScore,
        timeLimit
      }
    });

    return NextResponse.json(newFollowUp);
  } catch (error) {
    console.error("Error creating follow-up question:", error);
    return NextResponse.json({ error: "Failed to create follow-up question" }, { status: 500 });
  }
}

// User Answer API route
// File: app/api/hr-answers/[answerId]/route.ts

export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      hrQuestionId,
      hrFollowUpQuestionId,
      userAnswer,
      videoUrl
    } = body;

    // Verify the user can submit this answer (owns the question)
    if (hrQuestionId) {
      const question = await db.hRQuestion.findUnique({
        where: { id: hrQuestionId },
        include: {
          hrInterview: {
            select: {
              userId: true
            }
          }
        }
      });

      if (!question) {
        return NextResponse.json({ error: "Question not found" }, { status: 404 });
      }

      if (question.hrInterview.userId !== userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Check if an answer already exists
      const existingAnswer = await db.hRUserAnswer.findUnique({
        where: { hrQuestionId }
      });

      if (existingAnswer) {
        // Update existing answer
        const updatedAnswer = await db.hRUserAnswer.update({
          where: { id: existingAnswer.id },
          data: {
            userAnswer,
            videoUrl
          }
        });

        return NextResponse.json(updatedAnswer);
      }
    } else if (hrFollowUpQuestionId) {
      const followUp = await db.hRFollowUpQuestion.findUnique({
        where: { id: hrFollowUpQuestionId },
        include: {
          mainQuestion: {
            include: {
              hrInterview: {
                select: {
                  userId: true
                }
              }
            }
          }
        }
      });

      if (!followUp) {
        return NextResponse.json({ error: "Follow-up question not found" }, { status: 404 });
      }

      if (followUp.mainQuestion.hrInterview.userId !== userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: "Either hrQuestionId or hrFollowUpQuestionId is required" }, { status: 400 });
    }

    // Create a new answer
    const newAnswer = await db.hRUserAnswer.create({
      data: {
        hrQuestionId,
        hrFollowUpQuestionId,
        userId,
        userAnswer,
        videoUrl,
        matchedKeyPoints: []
      }
    });

    return NextResponse.json(newAnswer);
  } catch (error) {
    console.error("Error submitting answer:", error);
    return NextResponse.json({ error: "Failed to submit answer" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { answerId?: string } }) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { answerId } = params;
    if (!answerId) {
      return NextResponse.json({ error: "Answer ID is required" }, { status: 400 });
    }

    const body = await req.json();

    // Verify the user owns this answer
    const answer = await db.hRUserAnswer.findUnique({
      where: { id: answerId },
      include: {
        hrQuestion: {
          include: {
            hrInterview: {
              select: {
                userId: true
              }
            }
          }
        },
        followup: {
          include: {
            mainQuestion: {
              include: {
                hrInterview: {
                  select: {
                    userId: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!answer) {
      return NextResponse.json({ error: "Answer not found" }, { status: 404 });
    }

    // Check ownership via either the main question or follow-up question
    let isOwner = false;
    if (answer.hrQuestion) {
      isOwner = answer.hrQuestion.hrInterview.userId === userId;
    } else if (answer.followup) {
      isOwner = answer.followup.mainQuestion.hrInterview.userId === userId;
    }

    if (!isOwner) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Update the answer
    const updatedAnswer = await db.hRUserAnswer.update({
      where: {
        id: answerId
      },
      data: body
    });

    return NextResponse.json(updatedAnswer);
  } catch (error) {
    console.error("Error updating answer:", error);
    return NextResponse.json({ error: "Failed to update answer" }, { status: 500 });
  }
}
