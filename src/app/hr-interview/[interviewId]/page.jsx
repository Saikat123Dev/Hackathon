"use client"
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Loader2, Mic, MicOff, Send, Video, VideoOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

// Keys for localStorage
const MESSAGES_STORAGE_KEY = `hr-interview-messages-${typeof window !== 'undefined' ? window.location.pathname : ''}`
const INTERVIEW_STATE_KEY = `hr-interview-state-${typeof window !== 'undefined' ? window.location.pathname : ''}`

export default function HRInterviewPage({ params }) {
  const router = useRouter()
  const { interviewId } = React.use(params)

  const [interview, setInterview] = useState(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [isVideoEnabled, setIsVideoEnabled] = useState(true)
  const [userAnswer, setUserAnswer] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [messages, setMessages] = useState([])
  const [chatHistory, setChatHistory] = useState([])
  const [followUpQuestion, setFollowUpQuestion] = useState(null)
  const [isFollowUp, setIsFollowUp] = useState(false)
  const [interviewComplete, setInterviewComplete] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [transcribing, setTranscribing] = useState(false)

  const videoRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const audioChunksRef = useRef([])
  const chatContainerRef = useRef(null)
  const audioStreamRef = useRef(null)

  // Save interview state to localStorage
  const saveInterviewState = (state) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(INTERVIEW_STATE_KEY, JSON.stringify(state))
    }
  }

  // Load saved state and messages from localStorage on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Load interview state
      const savedState = localStorage.getItem(INTERVIEW_STATE_KEY)
      if (savedState) {
        try {
          const parsedState = JSON.parse(savedState)
          setCurrentQuestionIndex(parsedState.currentQuestionIndex || 0)
          setIsFollowUp(parsedState.isFollowUp || false)
          setFollowUpQuestion(parsedState.followUpQuestion || null)
          setInterviewComplete(parsedState.interviewComplete || false)
        } catch (error) {
          console.error('Error parsing saved interview state:', error)
        }
      }

      // Load messages
      const savedMessages = localStorage.getItem(MESSAGES_STORAGE_KEY)
      if (savedMessages) {
        try {
          const parsedMessages = JSON.parse(savedMessages)
          setMessages(parsedMessages)
        } catch (error) {
          console.error('Error parsing saved messages:', error)
        }
      }
    }
  }, [])

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages))
    }
  }, [messages])

  // Save interview state whenever relevant state changes
  useEffect(() => {
    const stateToSave = {
      currentQuestionIndex,
      isFollowUp,
      followUpQuestion,
      interviewComplete
    }
    saveInterviewState(stateToSave)
  }, [currentQuestionIndex, isFollowUp, followUpQuestion, interviewComplete])

  // Fetch interview data and chat history
  useEffect(() => {
    async function fetchData() {
      if (!interviewId) return

      try {
        setLoading(true)

        // Fetch interview data
        const interviewResponse = await fetch(`/api/hrRound/${interviewId}`)
        if (!interviewResponse.ok) throw new Error('Failed to fetch interview')
        const interviewData = await interviewResponse.json()
        setInterview(interviewData)

        // Set current question based on saved index or default to first question
        if (interviewData.questions?.length > 0) {
          const questionIndex = Math.min(currentQuestionIndex, interviewData.questions.length - 1)
          setCurrentQuestion(interviewData.questions[questionIndex])

          // If it's a follow-up question, we'll use the saved followUpQuestion
          // Otherwise, use the current question from the interview data
          if (!isFollowUp && followUpQuestion === null) {
            setCurrentQuestionIndex(questionIndex)
          }
        }

        // Check if we have saved messages
        const savedMessages = localStorage.getItem(MESSAGES_STORAGE_KEY)
        const hasSavedMessages = savedMessages && JSON.parse(savedMessages).length > 0

        // If no saved messages, fetch chat history from API
        if (!hasSavedMessages) {
          const chatResponse = await fetch(`/api/hrRound/${interviewId}/getChat`)
          if (!chatResponse.ok) throw new Error('Failed to fetch chat history')
          const chatData = await chatResponse.json()

          if (chatData.length > 0) {
            // Convert chat history to message format
            const chatMessages = chatData.flatMap((chat, index) => {
              const messages = []

              // Add question message
              messages.push({
                role: 'interviewer',
                content: chat.text,
                isQuestion: true,
                questionId: chat.id || `history-${index}`,
                timestamp: chat.timestamp || new Date().toISOString()
              })

              // Add user answer if available
              if (chat.userAnswer) {
                messages.push({
                  role: 'user',
                  content: chat.userAnswer,
                  questionId: chat.id || `history-${index}`,
                  timestamp: chat.timestamp || new Date().toISOString()
                })
              }

              // Add feedback if available
              if (chat.feedback) {
                messages.push({
                  role: 'system',
                  content: chat.feedback,
                  timestamp: chat.timestamp || new Date().toISOString()
                })
              }

              return messages
            })

            // Set messages from chat history
            setMessages(chatMessages)
          } else {
            // If no chat history, initialize with welcome and first question
            if (interviewData.questions?.length > 0) {
              const initialMessages = [
                {
                  role: 'system',
                  content: `Welcome to your HR interview for the ${interviewData.jobPosition} position. I'll be asking you some questions to get to know you better.`,
                  timestamp: new Date().toISOString()
                },
                {
                  role: 'interviewer',
                  content: isFollowUp && followUpQuestion
                    ? followUpQuestion.text
                    : interviewData.questions[currentQuestionIndex].text,
                  isQuestion: true,
                  questionId: isFollowUp && followUpQuestion
                    ? followUpQuestion.id
                    : interviewData.questions[currentQuestionIndex].id,
                  timestamp: new Date().toISOString()
                }
              ]

              setMessages(initialMessages)
            }
          }

          setHistoryLoaded(true)
        }

        setLoading(false)
      } catch (error) {
        console.error('Error fetching data:', error)
        toast.error('Failed to load interview data')
        setLoading(false)
      }
    }

    fetchData()
  }, [interviewId, currentQuestionIndex])

  // Scroll to bottom of chat whenever messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages])

  // Setup media devices (camera/mic)
  useEffect(() => {
    let stream = null

    async function setupMedia() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: isVideoEnabled,
          audio: true,
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (error) {
        console.error('Error accessing media devices:', error)
        toast.error('Could not access camera or microphone')
        setIsVideoEnabled(false)
      }
    }

    if (isRecording || isVideoEnabled) {
      setupMedia()
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [isRecording, isVideoEnabled])

  const startRecording = async () => {
    chunksRef.current = []
    audioChunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideoEnabled,
        audio: true,
      })

      audioStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      // Set up video recorder
      mediaRecorderRef.current = new MediaRecorder(stream)

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        chunksRef.current = []
      }

      // Set up audio recorder for transcription
      const audioStream = new MediaStream(stream.getAudioTracks());
      const audioRecorder = new MediaRecorder(audioStream);

      audioRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      audioRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        audioChunksRef.current = [];
      };

      // Start both recorders
      mediaRecorderRef.current.start();
      audioRecorder.start();

      // Store the audio recorder reference
      mediaRecorderRef.current.audioRecorder = audioRecorder;

      setIsRecording(true);
      toast.success('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error)
      toast.error('Failed to start recording')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Stop video recording
      mediaRecorderRef.current.stop()

      // Stop audio recording for transcription
      if (mediaRecorderRef.current.audioRecorder) {
        mediaRecorderRef.current.audioRecorder.stop();
      }

      setIsRecording(false)
      toast.success('Recording stopped')
    }
  }

  const transcribeAudio = async (audioBlob) => {
    try {
      setTranscribing(true);

      // Create form data with the audio blob
      const formData = new FormData();
      formData.append('audio', audioBlob);

      // Send to transcription API
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      console.log(data);
      // Add the transcribed text to the current answer
      if (data.transcript) {
        setUserAnswer(prev => {
          const separator = prev.trim().length > 0 ? ' ' : '';
          return prev + separator + data.transcript;
        });
        toast.success('Audio transcribed successfully');
      } else {
        toast.error('No text was transcribed');
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      toast.error('Failed to transcribe audio');
    } finally {
      setTranscribing(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim()) return;

    setSubmitting(true);
    stopRecording();

    try {
      const questionForAnswer = isFollowUp ? followUpQuestion : currentQuestion;
      if (!questionForAnswer) {
        throw new Error('No active question found');
      }

      const newUserMessage = {
        role: 'user',
        content: userAnswer,
        questionId: questionForAnswer.id,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, newUserMessage]);

      let videoUrl = null;
      if (chunksRef.current.length > 0) {
        const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' });
        videoUrl = URL.createObjectURL(videoBlob);
      }

      // Determine which endpoint and parameters to use
      const endpoint = '/api/hrRound/answer';
      const requestType = isFollowUp ? 'PUT' : 'POST';
      const requestBody = isFollowUp
        ? {
            followUpQuestionId: questionForAnswer.id,
            userAnswer,
            videoUrl,
          }
        : {
            hrQuestionId: questionForAnswer.id,
            userAnswer,
            videoUrl,
          };

      const response = await fetch(endpoint, {
        method: requestType,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Failed to submit answer');
      }

      const data = await response.json();

      const newSystemMessages = [
        {
          role: 'system',
          content: `Score: ${data.analysis.score}/${questionForAnswer.maxScore}`,
          isScore: true,
          timestamp: new Date().toISOString()
        },
        {
          role: 'system',
          content: data.analysis.evaluationFeedback,
          timestamp: new Date().toISOString()
        }
      ];

      setMessages(prev => [...prev, ...newSystemMessages]);

      // Handle next question or follow-up
      if (data.nextQuestion || data.followUpQuestion) {
        const nextQuestion = data.nextQuestion || data.followUpQuestion;
        setFollowUpQuestion(nextQuestion);
        setIsFollowUp(true);

        setTimeout(() => {
          const followUpMessage = {
            role: 'interviewer',
            content: nextQuestion.text,
            isQuestion: true,
            questionId: nextQuestion.id,
            timestamp: new Date().toISOString()
          };
          setMessages(prev => [...prev, followUpMessage]);
        }, 1000);
      } else {
        // Move to next question
        const nextIndex = currentQuestionIndex + 1;
        if (interview?.questions && interview.questions[nextIndex]) {
          setCurrentQuestionIndex(nextIndex);
          setCurrentQuestion(interview.questions[nextIndex]);
          setIsFollowUp(false);
          setFollowUpQuestion(null);

          setTimeout(() => {
            const nextQuestionMessage = {
              role: 'interviewer',
              content: interview.questions[nextIndex].text,
              isQuestion: true,
              questionId: interview.questions[nextIndex].id,
              timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, nextQuestionMessage]);
          }, 1000);
        } else {
          // Interview complete
          setInterviewComplete(true);

          setTimeout(() => {
            const completionMessage = {
              role: 'system',
              content: 'Thank you for completing the interview! Your responses have been recorded. You can now view your results.',
              timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, completionMessage]);
          }, 1000);
        }
      }

      setUserAnswer('');
    } catch (error) {
      console.error('Error submitting answer:', error);
      toast.error('Failed to submit answer: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewResults = () => {
    // Clear localStorage when interview is complete
    if (typeof window !== 'undefined') {
      localStorage.removeItem(MESSAGES_STORAGE_KEY)
      localStorage.removeItem(INTERVIEW_STATE_KEY)
    }
    router.push(`/hr-interview/${interviewId}/results`)
  }

  const startNewInterview = () => {
    // Clear localStorage to start fresh
    if (typeof window !== 'undefined') {
      localStorage.removeItem(MESSAGES_STORAGE_KEY)
      localStorage.removeItem(INTERVIEW_STATE_KEY)
    }

    // Reset state
    setCurrentQuestionIndex(0)
    setIsFollowUp(false)
    setFollowUpQuestion(null)
    setInterviewComplete(false)

    // Initialize with welcome message and first question if available
    if (interview?.questions?.length > 0) {
      const initialMessages = [
        {
          role: 'system',
          content: `Welcome to your HR interview for the ${interview.jobPosition} position. I'll be asking you some questions to get to know you better.`,
          timestamp: new Date().toISOString()
        },
        {
          role: 'interviewer',
          content: interview.questions[0].text,
          isQuestion: true,
          questionId: interview.questions[0].id,
          timestamp: new Date().toISOString()
        }
      ]
      setMessages(initialMessages)
      setCurrentQuestion(interview.questions[0])
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center p-6 rounded-xl shadow-md bg-white/80 backdrop-blur-sm">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <span className="block mt-4 text-xl font-medium text-gray-800">Loading your interview...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white/90 backdrop-blur-sm shadow-sm py-4 px-6 fixed top-0 left-0 right-0 z-10">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mr-3">
                <span className="text-white font-bold">HR</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
                {interview?.jobPosition || "Interview"}
              </h1>
            </div>
            <div className="flex space-x-3">
              {messages.length > 0 && !interviewComplete && (
                <Button
                  variant="outline"
                  className="border-blue-300 text-blue-600 hover:bg-blue-50"
                  onClick={startNewInterview}
                >
                  Start New Session
                </Button>
              )}
              {interviewComplete && (
                <Button
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-md hover:shadow-lg"
                  onClick={handleViewResults}
                >
                  View Results
                </Button>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col md:flex-row pt-[80px] pb-[80px]">
          {/* Left Section: Video/Avatar */}
          <div className="w-full md:w-1/2 flex flex-col items-center p-6">
            <div className="w-full max-w-lg relative h-full flex items-center">
              {isVideoEnabled ? (
                <div className="relative rounded-xl overflow-hidden shadow-2xl border border-gray-200 bg-gradient-to-br from-gray-800 to-black w-full transition-all duration-300 hover:shadow-blue-200/30">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover rounded-xl transition-opacity duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none rounded-xl" />
                  <div className="absolute bottom-4 left-4 flex items-center space-x-3">
                    <Avatar className="h-12 w-12 border-2 border-white shadow-md">
                      <AvatarImage src="/interviewer.png" alt="Interviewer" />
                      <AvatarFallback>HR</AvatarFallback>
                    </Avatar>
                    <div className="backdrop-blur-sm bg-black/20 p-1 px-2 rounded-md">
                      <p className="text-white font-semibold text-lg">Joanna</p>
                      <p className="text-gray-300 text-sm">HR Interviewer</p>
                    </div>
                  </div>
                  {isRecording && (
                    <div className="absolute top-4 right-4 flex items-center bg-red-500 text-white px-3 py-1 rounded-full text-sm shadow-md">
                      <span className="animate-pulse mr-2">●</span> Recording
                    </div>
                  )}
                  <div className="absolute top-4 left-4 flex space-x-2 opacity-0 hover:opacity-100 transition-opacity duration-300">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white bg-black/50 hover:bg-black/70 rounded-full"
                      onClick={() => setIsVideoEnabled(false)}
                    >
                      <VideoOff className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="relative flex items-center justify-center h-80 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl shadow-lg border border-gray-200 w-full">
                  <div className="text-center">
                    <Avatar className="h-32 w-32 mx-auto border-4 border-white shadow-lg">
                      <AvatarImage src="/interviewer.png" alt="Interviewer" />
                      <AvatarFallback>HR</AvatarFallback>
                    </Avatar>
                    <p className="mt-4 text-xl font-semibold text-gray-800">Joanna</p>
                    <p className="text-sm text-gray-500">HR Interviewer</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-4 right-4 text-gray-600 hover:text-gray-800"
                    onClick={() => setIsVideoEnabled(true)}
                  >
                    <Video className="h-6 w-6" />
                  </Button>
                </div>
              )}
            </div>

            {/* Current Question with enhanced UI */}
            <div className="w-full max-w-lg mt-6">
              <Card className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 shadow-md rounded-xl">
                <div className="mb-2 pb-2 border-b border-blue-200 flex items-center">
                  <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center mr-2">
                    <span className="text-white text-xs font-bold">Q</span>
                  </div>
                  <h3 className="font-semibold text-blue-800">Current Question:</h3>
                </div>
                <p className="text-gray-800 text-lg font-medium pl-2 border-l-4 border-blue-300">
                  {isFollowUp && followUpQuestion
                    ? followUpQuestion.text
                    : currentQuestion?.text || "Loading question..."}
                </p>
                {currentQuestion && !isFollowUp && (
                  <div className="mt-3 text-xs text-gray-500 flex items-center">
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full mr-2">
                      Question {currentQuestionIndex + 1}/{interview?.questions?.length || '?'}
                    </span>
                    {currentQuestion.category && (
                      <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
                        {currentQuestion.category}
                      </span>
                    )}
                  </div>
                )}
              </Card>
            </div>
          </div>

          {/* Right Section: Chat and Textarea with enhanced UI */}
          <div className="w-full md:w-1/2 flex flex-col bg-white/90 backdrop-blur-sm rounded-xl shadow-md p-6 mx-4 md:mx-6 my-4 md:my-0 border border-gray-100">
            {/* Chat Header */}
            <div className="mb-4 pb-2 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                <span className="w-4 h-4 bg-green-500 rounded-full mr-2"></span>
                Interview Chat
              </h2>
              {messages.length > 0 && (
                <span className="text-xs text-gray-500">{messages.length} messages</span>
              )}
            </div>

            {/* Chat Area */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 custom-scrollbar"
              style={{ maxHeight: 'calc(100vh - 280px)' }}
            >
              {/* Messages */}
              {messages.map((message, index) => (
                <div
                  key={`message-${index}`}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  } animate-fadeIn`}
                >
                  {message.role !== 'user' && (
                    <Avatar className="h-8 w-8 mr-2 mt-1 flex-shrink-0">
                      <AvatarImage
                        src={
                          message.role === 'interviewer'
                            ? "/interviewer.png"
                            : "/system-icon.png"
                        }
                        alt={message.role === 'interviewer' ? "Interviewer" : "System"}
                      />
                      <AvatarFallback>
                        {message.role === 'interviewer' ? 'HR' : 'SYS'}
                      </AvatarFallback>
                    </Avatar>
                  )}

                  <Card
                    className={`p-4 max-w-[85%] rounded-2xl shadow-sm transition-all duration-200 ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                        : message.role === 'interviewer'
                        ? 'bg-gray-50 text-gray-800 border border-gray-200'
                        : message.isScore
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {message.isQuestion && (
                      <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded mb-1">
                        Question
                      </span>
                    )}
                    {message.isScore && (
                      <span className="inline-block bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded mb-1">
                        Score
                      </span>
                    )}
                    <p className={message.role === 'system' && !message.isScore ? 'text-sm' : ''}>{message.content}</p>
                    {message.timestamp && (
                      <p className={`text-xs mt-1 ${
                        message.role === 'user' ? 'text-blue-200' : 'text-gray-500'
                      }`}>
                        {new Date(message.timestamp).toLocaleString()}
                      </p>
                    )}
                  </Card>

                  {message.role === 'user' && (
                    <Avatar className="h-8 w-8 ml-2 mt-1 flex-shrink-0">
                      <AvatarImage src="/user-avatar.png" alt="You" />
                      <AvatarFallback>You</AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {submitting && (
                <div className="flex justify-start">
                  <Avatar className="h-8 w-8 mr-2 mt-1 flex-shrink-0">
                    <AvatarImage src="/system-icon.png" alt="System" />
                    <AvatarFallback>SYS</AvatarFallback>
                  </Avatar>
                  <Card className="p-3 max-w-[85%] bg-gray-100 text-gray-800 rounded-2xl flex items-center">
                    <div className="flex space-x-2">
                    <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                      <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                      <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "600ms" }}></div>
                    </div>
                    <span className="ml-2 text-sm text-gray-600">Processing...</span>
                  </Card>
                </div>
              )}

              {transcribing && (
                <div className="flex justify-start">
                  <Avatar className="h-8 w-8 mr-2 mt-1 flex-shrink-0">
                    <AvatarImage src="/system-icon.png" alt="System" />
                    <AvatarFallback>SYS</AvatarFallback>
                  </Avatar>
                  <Card className="p-3 max-w-[85%] bg-gray-100 text-gray-800 rounded-2xl flex items-center">
                    <div className="flex space-x-2">
                      <div className="h-2 w-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                      <div className="h-2 w-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                      <div className="h-2 w-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: "600ms" }}></div>
                    </div>
                    <span className="ml-2 text-sm text-gray-600">Transcribing audio...</span>
                  </Card>
                </div>
              )}
            </div>

            {/* Input Area */}
            {!interviewComplete && (
              <div className="mt-4 border-t pt-4">
                <textarea
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  className="w-full p-3 min-h-[120px] border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all duration-200"
                  disabled={submitting || isRecording}
                />
                <div className="mt-2 flex justify-between items-center">
                  <div className="flex space-x-2">
                    {isRecording ? (
                      <Button
                        variant="outline"
                        className="text-red-500 border-red-300 hover:bg-red-50"
                        onClick={stopRecording}
                      >
                        <MicOff className="h-4 w-4 mr-1" />
                        Stop Recording
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="text-blue-600 border-blue-300 hover:bg-blue-50"
                        onClick={startRecording}
                      >
                        <Mic className="h-4 w-4 mr-1" />
                        Record Answer
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="text-gray-600 hover:bg-gray-100"
                      onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                    >
                      {isVideoEnabled ? <VideoOff className="h-4 w-4 mr-1" /> : <Video className="h-4 w-4 mr-1" />}
                      {isVideoEnabled ? 'Disable Video' : 'Enable Video'}
                    </Button>
                  </div>
                  <Button
                    onClick={handleSubmitAnswer}
                    disabled={!userAnswer.trim() || submitting}
                    className={`bg-gradient-to-r ${
                      !userAnswer.trim() || submitting
                        ? 'from-gray-400 to-gray-500 cursor-not-allowed'
                        : 'from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'
                    } text-white px-4 py-2 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg`}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" /> Submit Answer
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Interview Complete Actions */}
            {interviewComplete && (
              <div className="border rounded-xl p-6 bg-gradient-to-r from-green-50 to-blue-50 text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800">Interview Complete!</h3>
                <p className="text-gray-600">Thank you for completing the interview. Your responses have been recorded.</p>
                <Button
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-md hover:shadow-lg"
                  onClick={handleViewResults}
                >
                  View Your Results
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-white/90 backdrop-blur-sm py-3 px-6 border-t border-gray-200 fixed bottom-0 left-0 right-0 z-10">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <p className="text-sm text-gray-500">
              {interview?.companyName ? `© ${new Date().getFullYear()} ${interview.companyName}` : '© 2023 HR Interview System'}
            </p>
            <div className="text-sm text-gray-500">
              {currentQuestion && !interviewComplete && `Question ${currentQuestionIndex + 1}/${interview?.questions?.length || '?'}`}
              {interviewComplete && 'Interview completed'}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
