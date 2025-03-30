'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'react-hot-toast';

const difficultyOptions = [
  { value: 'BEGINNER', label: 'Beginner' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
  { value: 'EXPERT', label: 'Expert' }
];

export default function HRInterviewForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [skills, setSkills] = useState(['']);
  const [formData, setFormData] = useState({
    jobPosition: '',
    jobDescription: '',
    jobExperience: 1,
    difficultyLevel: 'INTERMEDIATE',
    totalQuestions: 5
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSkillChange = (index, value) => {
    const updatedSkills = [...skills];
    updatedSkills[index] = value;
    setSkills(updatedSkills);
  };

  const addSkillField = () => {
    setSkills([...skills, '']);
  };

  const removeSkillField = (index) => {
    const updatedSkills = [...skills];
    updatedSkills.splice(index, 1);
    setSkills(updatedSkills);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Filter out empty skills
      const filteredSkills = skills.filter(skill => skill.trim() !== '');

      const response = await fetch('/api/hrInterview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          skills: filteredSkills,
          jobExperience: Number(formData.jobExperience),
          totalQuestions: Number(formData.totalQuestions)
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create HR Interview');
      }

      toast.success('HR Interview created successfully!');

      // Using interviewId as the parameter name to match your route structure
      router.push(`/hr-interviews/${data.hrInterview.id}`);
    } catch (error) {
      toast.error(error.message || 'Something went wrong');
      console.error('Error creating HR Interview:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Create HR Interview</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Job Position */}
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="jobPosition" className="block text-sm font-medium text-gray-700 mb-1">
              Job Position <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="jobPosition"
              name="jobPosition"
              value={formData.jobPosition}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g. Frontend Developer"
            />
          </div>

          {/* Job Experience */}
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="jobExperience" className="block text-sm font-medium text-gray-700 mb-1">
              Experience Required (years) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="jobExperience"
              name="jobExperience"
              min="0"
              max="20"
              value={formData.jobExperience}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Difficulty Level */}
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="difficultyLevel" className="block text-sm font-medium text-gray-700 mb-1">
              Difficulty Level <span className="text-red-500">*</span>
            </label>
            <select
              id="difficultyLevel"
              name="difficultyLevel"
              value={formData.difficultyLevel}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              {difficultyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Total Questions */}
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="totalQuestions" className="block text-sm font-medium text-gray-700 mb-1">
              Number of Questions <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="totalQuestions"
              name="totalQuestions"
              min="1"
              max="20"
              value={formData.totalQuestions}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Job Description */}
          <div className="col-span-2">
            <label htmlFor="jobDescription" className="block text-sm font-medium text-gray-700 mb-1">
              Job Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="jobDescription"
              name="jobDescription"
              value={formData.jobDescription}
              onChange={handleInputChange}
              required
              rows="4"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Provide a detailed description of the job role and responsibilities..."
            ></textarea>
          </div>

          {/* Skills */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Required Skills
            </label>
            <div className="space-y-3">
              {skills.map((skill, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={skill}
                    onChange={(e) => handleSkillChange(index, e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder={`Skill ${index + 1}`}
                  />
                  {skills.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSkillField(index)}
                      className="p-2 text-red-500 hover:text-red-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  {index === skills.length - 1 && (
                    <button
                      type="button"
                      onClick={addSkillField}
                      className="p-2 text-blue-500 hover:text-blue-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-1 text-sm text-gray-500">Add all skills required for this position</p>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end mt-8">
          <button
            type="submit"
            disabled={isLoading}
            className={`px-6 py-3 text-white font-medium rounded-md transition-colors ${
              isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating Questions...
              </div>
            ) : (
              'Create HR Interview'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
