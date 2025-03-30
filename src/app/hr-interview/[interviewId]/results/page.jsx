"use client"

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  ArrowLeft,
  BarChart,
  Book,
  CheckCircle,
  Download,
  Loader2,
  Star,
  ThumbsUp
} from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function InterviewResults() {
  const router = useRouter()
  const { interviewId } = useParams()
  const [results, setResults] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const response = await fetch(`/api/hrRound/${interviewId}`)
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to fetch results')
        }

        const data = await response.json()
        setResults(data)
      } catch (error) {
        console.error('Error fetching results:', error)
        setError(error.message)
      } finally {
        setIsLoading(false)
      }
    }

    if (interviewId) {
      fetchResults()
    }
  }, [interviewId])

  const getTotalScore = () => {
    if (!results || !results.questions) return 0

    const totalScore = results.questions.reduce((sum, question) => {
      return sum + (question.userAnswer?.score || 0)
    }, 0)

    return totalScore
  }

  const getMaxPossibleScore = () => {
    if (!results || !results.questions) return 0

    const maxScore = results.questions.reduce((sum, question) => {
      return sum + (question.maxScore || 0)
    }, 0)

    return maxScore
  }

  const calculatePercentage = () => {
    const totalScore = getTotalScore()
    const maxScore = getMaxPossibleScore()

    return maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0
  }

  const getScoreColor = (score, maxScore) => {
    const percentage = (score / maxScore) * 100

    if (percentage >= 80) return 'text-green-600'
    if (percentage >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const downloadResults = () => {
    if (!results) return

    const jsonData = JSON.stringify(results, null, 2)
    const blob = new Blob([jsonData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `hr-interview-results-${interviewId}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <span className="text-xl font-medium">Loading interview results...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 text-center">
        <div className="max-w-md mx-auto bg-red-50 p-6 rounded-lg border border-red-200">
          <h1 className="text-2xl font-bold mb-4 text-red-600">Error</h1>
          <p className="mb-6 text-red-700">{error}</p>
          <Button onClick={() => router.push('/hr-interview')}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  if (!results) {
    return (
      <div className="container mx-auto p-6 text-center">
        <div className="max-w-md mx-auto bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h1 className="text-2xl font-bold mb-4">Results Not Found</h1>
          <p className="mb-6">The results for this interview could not be found.</p>
          <Button onClick={() => router.push('/hr-interview')}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  const scorePercentage = calculatePercentage()
  const isPassing = scorePercentage >= (results.passScore || 70)

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => router.push('/hr-interview')}
        className="mb-6 hover:bg-gray-100"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
      </Button>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">{results.jobPosition}</h1>
          <p className="text-gray-500">Interview Results</p>
        </div>
        <Button
          variant="outline"
          onClick={downloadResults}
          className="mt-4 md:mt-0 hover:bg-gray-100"
        >
          <Download className="mr-2 h-4 w-4" /> Download Results
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="border-t-4 border-t-primary shadow-sm hover:shadow transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-500">Overall Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline">
              <span className={`text-4xl font-bold ${isPassing ? 'text-green-600' : 'text-red-600'}`}>
                {scorePercentage}%
              </span>
              <span className="text-sm text-gray-500 ml-2">
                ({getTotalScore()}/{getMaxPossibleScore()})
              </span>
            </div>
            <Progress
              value={scorePercentage}
              className={`h-2 mt-2 ${isPassing ? 'bg-green-100' : 'bg-red-100'}`}
            />
            <div className="mt-4 flex items-center">
              {isPassing ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  <span className="text-green-600 font-medium">Passed</span>
                </>
              ) : (
                <>
                  <Badge variant="destructive">Needs Improvement</Badge>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-green-500 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-500">
              <div className="flex items-center">
                <Star className="h-4 w-4 mr-2 text-green-500" /> Strengths
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {results.analysis?.strengths?.map((strength, index) => (
                <li key={index} className="flex items-start">
                  <ThumbsUp className="h-4 w-4 text-green-600 mr-2 mt-1 shrink-0" />
                  <span className="text-sm">{strength}</span>
                </li>
              )) || (
                <li className="text-sm text-gray-500 italic">No strengths analyzed yet</li>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-amber-500 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-500">
              <div className="flex items-center">
                <Book className="h-4 w-4 mr-2 text-amber-500" /> Areas to Improve
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {results.analysis?.improvements?.map((improvement, index) => (
                <li key={index} className="flex items-start">
                  <BarChart className="h-4 w-4 text-amber-600 mr-2 mt-1 shrink-0" />
                  <span className="text-sm">{improvement}</span>
                </li>
              )) || (
                <li className="text-sm text-gray-500 italic">No improvement areas analyzed yet</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-2xl font-bold mb-4 border-b pb-2">Question Analysis</h2>

      {results?.questions?.map((question, index) => (
        <Card key={index} className="mb-6 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="bg-gray-50 rounded-t-lg">
            <CardTitle className="text-lg">
              Question {index + 1}: {question.text}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="mb-4">
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">Score</span>
                <span className={`text-sm font-medium ${getScoreColor(question.userAnswer?.score || 0, question.maxScore)}`}>
                  {question.userAnswer?.score || 0}/{question.maxScore}
                </span>
              </div>
              <Progress
                value={((question.userAnswer?.score || 0) / question.maxScore) * 100}
                className="h-2"
              />
            </div>

            <div className="mb-4">
              <h4 className="font-medium mb-2 text-gray-700">Your Answer:</h4>
              <p className="text-sm bg-gray-50 p-4 rounded-md border border-gray-100">
                {question.userAnswer?.text || "No answer provided"}
              </p>
            </div>

            <div className="mb-4">
              <h4 className="font-medium mb-2 text-gray-700">Feedback:</h4>
              <p className="text-sm">{question.userAnswer?.feedback || "No feedback available"}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2 text-gray-700">Key Points Covered:</h4>
                <ul className="space-y-1">
                  {question.userAnswer?.keyPointsCovered?.map((point, idx) => (
                    <li key={idx} className="flex items-start text-sm">
                      <CheckCircle className="h-4 w-4 text-green-600 mr-2 shrink-0 mt-0.5" />
                      {point}
                    </li>
                  )) || (
                    <li className="text-sm text-gray-500 italic">No key points covered</li>
                  )}
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-2 text-gray-700">Key Points Missed:</h4>
                <ul className="space-y-1">
                  {question.userAnswer?.keyPointsMissed?.map((point, idx) => (
                    <li key={idx} className="flex items-start text-sm">
                      <BarChart className="h-4 w-4 text-amber-600 mr-2 shrink-0 mt-0.5" />
                      {point}
                    </li>
                  )) || (
                    <li className="text-sm text-gray-500 italic">No key points missed</li>
                  )}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-center mt-12 mb-8">
        <Button onClick={() => router.push('/hr-interview')} size="lg" className="px-6">
          Back to Dashboard
        </Button>
      </div>
    </div>
  )
}
