import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: { interviewId?: string } }) {
  try {
    const { userId } =await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { interviewId } = params;

    if (interviewId) {
      // Fetch a specific HR Interview
      const hrInterview = await db.hRInterview.findUnique({
        where: {
          id: interviewId,
          userId
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
        return NextResponse.json({ error: "HR Interview not found" }, { status: 404 });
      }

      return NextResponse.json(hrInterview);
    } else {
      // Fetch all HR Interviews for the user
      const hrInterviews = await db.hRInterview.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { questions: true }
          }
        }
      });

      return NextResponse.json(hrInterviews);
    }
  } catch (error) {
    console.error("Error retrieving HR interviews:", error);
    return NextResponse.json({ error: "Failed to retrieve interviews" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { interviewId?: string } }) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { interviewId } = params;
    if (!interviewId) {
      return NextResponse.json({ error: "HR Interview ID is required" }, { status: 400 });
    }

    // Delete the HR Interview
    await db.hRInterview.deleteMany({
      where: {
        id: interviewId,
        userId
      }
    });

    return NextResponse.json({
      success: true,
      message: "HR Interview deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting HR interview:", error);
    return NextResponse.json({ error: "Failed to delete interview" }, { status: 500 });
  }
}

// Add POST method to create a new HR Interview
export async function POST(req: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      jobPosition,
      jobDescription,
      jobExperience,
      skills,
      difficultyLevel,
      resumeUrl,
      passScore
    } = body;

    // Create a new HR Interview
    const newInterview = await db.hRInterview.create({
      data: {
        userId,
        jobPosition,
        jobDescription,
        jobExperience,
        skills,
        difficultyLevel,
        resumeUrl,
        passScore,
        totalScore: 0
      }
    });

    return NextResponse.json(newInterview);
  } catch (error) {
    console.error("Error creating HR interview:", error);
    return NextResponse.json({ error: "Failed to create interview" }, { status: 500 });
  }
}

// Add PATCH method to update an HR Interview
export async function PATCH(req: NextRequest, { params }: { params: { interviewId?: string } }) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { interviewId } = params;
    if (!interviewId) {
      return NextResponse.json({ error: "HR Interview ID is required" }, { status: 400 });
    }

    const body = await req.json();

    // Update the HR Interview
    const updatedInterview = await db.hRInterview.update({
      where: {
        id: interviewId,
        userId
      },
      data: body
    });

    return NextResponse.json(updatedInterview);
  } catch (error) {
    console.error("Error updating HR interview:", error);
    return NextResponse.json({ error: "Failed to update interview" }, { status: 500 });
  }
}
