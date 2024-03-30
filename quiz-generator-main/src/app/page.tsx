"use client";
import _ from "lodash";
import { ChangeEvent, useState } from "react";
import { useDropzone } from "react-dropzone";
import Spinner from "./components/Spinner";

// Import for PDFJS
import * as pdfjs from "pdfjs-dist";

import { getVertexAI } from "./vertex";
import { formatFileSize } from "./utils";
const workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10240000;

type Question = {
  question: string;
  choices: string[];
  answer: string;
};

export default function Home() {
  const [mode, setMode] = useState(0);
  const [questions, setQuestions] = useState<Question[]>([]);
  const QuestionStepper = () => {
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedChoice, setSelectedChoice] = useState<null | number>(null);
    const [answers, setAnswers] = useState(Array(questions.length).fill(null));

    const handleChoiceClick = (choiceIndex: number) => {
      setSelectedChoice(choiceIndex);
      const newAnswers = [...answers];
      newAnswers[currentQuestion] = choiceIndex;
      setAnswers(newAnswers);
    };

    const handleNextQuestion = () => {
      setCurrentQuestion(currentQuestion + 1);
      if (currentQuestion + 1 < questions.length) {
        setSelectedChoice(answers[currentQuestion + 1]);
      }
    };

    const handlePrevQuestion = () => {
      setCurrentQuestion(currentQuestion - 1);
      if (currentQuestion - 1 >= 0) {
        setSelectedChoice(answers[currentQuestion - 1]);
      }
    };

    const isAnswerCorrect = (questionIndex: number, choiceIndex: number) => {
      return questions[questionIndex].choices[choiceIndex] === questions[questionIndex].answer;
    };

    const isSelected = (choiceIndex: number) => {
      const answer = answers[currentQuestion];
      return answer === choiceIndex || selectedChoice === choiceIndex;
    };

    const onRedoQuiz = () => {
      setQuestions([..._.shuffle(questions)]);
      setCurrentQuestion(0);
      setSelectedChoice(null);
      setAnswers(Array(questions.length).fill(null));
    };

    return (
      <div className="max-w-lg mx-auto sm:py-36">
        {currentQuestion < questions.length ? (
          <div>
            <div className="mt-8 items-center">
              <div className="text-center my-4">{`${currentQuestion + 1} / ${questions.length}`}</div>
              <div className="flex items-center">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }} />
                </div>
              </div>
            </div>
            <h2 className="text-2xl font-bold my-4">{questions[currentQuestion].question}</h2>
            <div className="grid grid-cols-2 gap-4">
              {questions[currentQuestion].choices.map((choice, index) => (
                <button key={index} className={`p-4 rounded bg-gray-100 ${isSelected(index) && "ring-2"}`} onClick={() => handleChoiceClick(index)}>
                  {choice}
                </button>
              ))}
            </div>
            <div className="mt-8 justify-center gap-4 items-center flex">
              <button type="button" className="text-white bg-blue-500 hover:bg-blue-600 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 cursor-pointer" onClick={handlePrevQuestion} disabled={currentQuestion === 0}>
                Prev
              </button>

              <button className="text-white bg-blue-500 hover:bg-blue-600 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 cursor-pointer" onClick={handleNextQuestion} disabled={selectedChoice === null}>
                Next
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold mb-4">Quiz Results</h2>
            <p className="mb-4">{`You scored ${answers.filter((answer, index) => isAnswerCorrect(index, answer)).length} out of ${questions.length} questions correctly.`}</p>
            <div>
              {questions.map((question, index) => (
                <div key={index} className="mb-4">
                  <p className="font-bold">{question.question}</p>
                  <p>{`Your answer: ${question.choices[answers[index]]}`}</p>
                  <p>{`Correct answer: ${question.answer}`}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 justify-center gap-4 items-center flex">
              <button type="button" className="text-white bg-blue-500 hover:bg-blue-600 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 cursor-pointer" onClick={onRedoQuiz}>
                Restart quiz
              </button>

              <button
                className="text-white bg-blue-500 hover:bg-blue-600 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 cursor-pointer"
                onClick={() => {
                  setMode(0);
                }}
                disabled={selectedChoice === null}
              >
                Create new quiz
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const CreateQuiz = () => {
    const [loading, setLoading] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [difficulty, setDifficulty] = useState("easy");
    const [numQuestions, setNumQuestions] = useState(5);
    const [fileProcessNum, setFileProcessNum] = useState(0);
    const handleNumQuestionsChange = (event: ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(event.target.value, 10);
      setNumQuestions(value);
    };

    const removeFile = (file: File) => {
      setFiles((prev) => prev.filter((f) => f !== file));
    };

    const onDropAccepted = (acceptedFiles: File[]) => {
      const numAllow = MAX_FILES - files.length;
      setFiles((prev) => [...prev, ...acceptedFiles.slice(0, numAllow)]);
      if (acceptedFiles.length - numAllow > 0) {
        alert("Exceeded maximum files: 5");
      }
    };

    const generateQuiz = async () => {
      setLoading(true);

      const { generativeModel } = getVertexAI();
      const session = generativeModel.startChat();
      await session.sendMessage(`
        I will feed you large volume of data, please digest them and DO NOT reply me until I say ' END OF DATA '
      `);

      for (let i = 0; i < files.length; i++) {
        setFileProcessNum(i + 1);
        const pageText = [];
        const file = files[i];
        const document = pdfjs.getDocument(await file.arrayBuffer());
        const proxy = await document.promise;
        for (let pageNo = 1; pageNo <= proxy.numPages; pageNo++) {
          const page = await proxy.getPage(pageNo);
          const content = await page.getTextContent();
          pageText.push(content.items.map((s) => ("str" in s ? s.str : "")).join(" "));
        }
        const payload = pageText.join(" ");
        console.log("Sending data chunk: ", payload.length);
        await session.sendMessage(payload);
      }

      setFileProcessNum(0);
      for (let tries = 0; tries < 3; tries++) {
        const result = await session.sendMessage(
          ` END OF DATA  
            Generate a quiz based on all the data I have feed you, according to the following specifications:
            - number of questions: ${numQuestions}
            - difficulty: ${difficulty}
            - maximum number of choices: 4
            Output should (only) be an array of objects with keys 'question', 'choices', and 'answer'.`
        );
        try {
          const response = result.response.candidates[tries].content.parts[0].text?.replace(/`/g, "");
          console.log(response);
          const questions: Question[] = JSON.parse(response ?? "[]") as Question[];
          setQuestions(questions);
          break;
        } catch (err) {
          console.log(err);
          if (tries == 2) {
            alert("Something went wrong with Gemini");
            throw err;
          }
        }
      }
      setMode(1);
      setFiles([]);
      setLoading(false);
      setFileProcessNum(0);
    };

    const { getRootProps, getInputProps } = useDropzone({ maxSize: MAX_FILE_SIZE, onDropAccepted, accept: { "application/pdf": [] } });

    return (
      <div className="mx-auto max-w-2xl sm:py-36">
        <form className="bg-white border border-gray-200 rounded-lg p-8">
          <div className="space-y-12">
            <div className="border-gray-900/10 pb-12">
              <h1 className="text-xl font-semibold leading-7 text-gray-900 mb-4">Generate Quiz from PDF</h1>
              <div className="col-span-full">
                <label htmlFor="cover-photo" className="block text-sm font-medium leading-6 text-gray-900">
                  Upload content - Maximum 5 files
                </label>
                <div {...getRootProps({ className: "cursor-pointer dropzone mt-2 flex justify-center rounded-lg border border-dashed border-gray-900/25 px-6 py-10 " })}>
                  <div className="text-center">
                    <div className="mt-4 flex text-sm leading-6 text-gray-600">
                      <label htmlFor="file-upload" className="relative rounded-md bg-white font-semibold text-blue-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 hover:text-indigo-500">
                        <span>Upload a file</span>
                        <input {...getInputProps()} />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs leading-5 text-gray-600">PDF up to 10MB</p>
                  </div>
                </div>
                {files.map((file) => (
                  <div key={file.size} className="bg-white border border-gray-200 rounded-lg  p-4 my-4">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-gray-800 text-sm font-semibold">
                        {file.name} - <span className="text-xs text-blue-600"> {formatFileSize(file.size)}</span>
                      </p>
                      <button className="text-red-500 text-sm hover:text-red-700 focus:outline-none" onClick={() => removeFile(file)}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-6 mb-6 md:grid-cols-2 mt-8">
                <div>
                  <label htmlFor="countries" className="block mb-2 text-sm font-medium text-gray-900">
                    Select a difficulty
                  </label>
                  <select id="difficulty" onChange={(e: ChangeEvent<HTMLSelectElement>) => setDifficulty(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-3">
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="default-input" className="block mb-2 text-sm font-medium text-gray-900">
                    No of questions (Max. 15)
                  </label>
                  <input type="number" value={numQuestions} min={1} max={15} maxLength={2} onChange={handleNumQuestionsChange} id="default-input" className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" />
                </div>
              </div>

              <button type="button" onClick={generateQuiz} className={`text-center w-full mt-4 text-white ${files.length > 0 && numQuestions <= 15 && numQuestions > 0 && !loading ? "bg-blue-600 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300" : "bg-gray-400 cursor-not-allowed"}   font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2`} disabled={files.length === 0}>
                {loading ? (
                  <div>
                    <span className="mr-2">{fileProcessNum === 0 ? "Generating quiz" : `Processing file ${fileProcessNum} / ${files.length}`}</span> <Spinner />
                  </div>
                ) : (
                  "Generate quiz"
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  };

  switch (mode) {
    case 0:
      return <CreateQuiz />;
    case 1:
      return <QuestionStepper />;
    default:
      break;
  }
}
