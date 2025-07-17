// DOM Elements
const registrationSection = document.getElementById('registration-section');
const interviewSection = document.getElementById('interview-section');
const resultsSection = document.getElementById('results-section');
const registrationForm = document.getElementById('registration-form');
const chatMessages = document.getElementById('chat-messages');
const voiceBtn = document.getElementById('voice-btn');
const voiceStatus = document.getElementById('voice-status');
const endInterviewBtn = document.getElementById('end-interview-btn');
const progressBar = document.getElementById('progress-bar');
const questionCounter = document.getElementById('question-counter');
const timer = document.getElementById('timer');
const cameraFeed = document.getElementById('camera-feed');
const warningAlert = document.querySelector('.warning-alert');
const warningMessage = document.getElementById('warning-message');
const hrName = document.getElementById('hr-name');
const submitText = document.getElementById('submit-text');
const submitLoading = document.getElementById('submit-loading');
const responseTimerContainer = document.getElementById('response-timer-container');
const responseTimer = document.getElementById('response-timer');
const responseTimerText = document.getElementById('response-timer-text');
const responseDots = document.getElementById('response-dots');
const newInterviewBtn = document.getElementById('new-interview-btn');

// AI Configuration
const AI_NAME = "Priya Sharma";
const AI_POSITION = "Senior HR Manager";
// New version (image avatar)
const AI_AVATAR = '<img src="smart.jpg" alt="Priya Sharma" class="hr-avatar-img" style="width: 50px;height:50px; border-radius: 100%;">';
const RESPONSE_TIME_LIMIT = 25; // 15 seconds per question

// Interview State
let interviewState = {
    candidate: {},
    currentQuestions: [],
    currentQuestionIndex: 0,
    answers: [],
    startTime: null,
        // ... existing properties ...
    strictPrivacyMode: true, // New flag for strict privacy
    maxPrivacyViolations: 1, // Terminate after 1 violation
    privacyViolations: 0,
    blurTime: null,
    maxBlurDuration: 2000, // 2 seconds max
    windowFocusListener: null,
    blurListener: null,
    visibilityChangeListener: null,
    timerInterval: null,
    responseTimerInterval: null,
    recognition: null,
    isSpeaking: false,
    cheatingWarnings: 0,
    isTabActive: true,
    questionCount: 5,
    isInterviewStarted: false,
    femaleVoice: null,
    textInputFallback: false,
    isMCQ: false,
    currentMCQOptions: [],
    responseTimes: [],
    currentResponseStartTime: null
};

// Initialize the application
function init() {
    setupEventListeners();
    checkCameraAccess();
        setupPrivacyMonitoring(); // Changed from setupTabMonitoring();
    initializeSpeechRecognition();
    loadVoices();
    
}

function loadVoices() {
    return new Promise((resolve) => {
        let voices = window.speechSynthesis.getVoices();

        if (voices.length !== 0) {
            setFemaleVoice(voices);
            resolve();
        } else {
            const interval = setInterval(() => {
                voices = window.speechSynthesis.getVoices();
                if (voices.length !== 0) {
                    setFemaleVoice(voices);
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        }
    });
}

function setFemaleVoice(voices) {
    interviewState.femaleVoice = voices.find(voice =>
        voice.name.includes('Female') ||
        voice.name.includes('Woman') ||
        voice.lang.includes('en-IN') ||
        voice.name.toLowerCase().includes('priya') ||
        voice.name.toLowerCase().includes('neha')
    );
}
async function checkCameraAccess() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        cameraFeed.innerHTML = '<div class="text-center p-4">Camera not supported in your browser</div>';
        interviewState.cameraAccessGranted = false;
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        cameraFeed.srcObject = stream;
        interviewState.cameraAccessGranted = true;
        
        // Add event listener for when stream ends
        stream.getVideoTracks()[0].addEventListener('ended', () => {
            showWarning("Camera feed was interrupted. Please check your camera connection.");
            interviewState.cameraAccessGranted = false;
        });
    } catch (err) {
        console.error('Camera access error:', err);
        cameraFeed.innerHTML = '<div class="text-center p-4">Camera access denied. Please enable camera permissions.</div>';
        interviewState.cameraAccessGranted = false;
    }
}
// Set up event listeners
function setupEventListeners() {
    registrationForm.addEventListener('submit', handleRegistrationSubmit);
    voiceBtn.addEventListener('click', handleVoiceButtonClick);
    endInterviewBtn.addEventListener('click', endInterview);
    document.getElementById('download-report').addEventListener('click', generateAndDownloadReport);
    newInterviewBtn.addEventListener('click', startNewInterview);
}

// Handle registration form submission
async function handleRegistrationSubmit(e) {
    e.preventDefault();
    
    // Show loading state
    submitText.style.display = 'none';
    submitLoading.style.display = 'inline';
    
    interviewState.candidate = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        role: document.getElementById('role').value,
        experience: document.getElementById('experience').value
    };
    
    interviewState.questionCount = parseInt(document.getElementById('question-count').value);
    
    // First check camera access
    await checkCameraAccess();
    
    // Only proceed if camera access was granted
    if (interviewState.cameraAccessGranted) {
        registrationSection.style.display = 'none';
        interviewSection.style.display = 'block';
        
        // Show loading state while generating questions
        displayAIMessage("Thank you for your information. I'm preparing your interview questions...", true);
        
        // Generate questions based on role and experience
        await generateInterviewQuestions();
        
        startInterview();
    } else {
        // Show message that camera access is required
        displayAIMessage("Camera access is required to proceed with the interview. Please enable camera permissions and try again.", true);
    }
    
    // Reset button state
    submitText.style.display = 'inline';
    submitLoading.style.display = 'none';
}

// Generate interview questions with diverse topics for insurance industry
async function generateInterviewQuestions() {
    const role = interviewState.candidate.role;
    const experience = interviewState.candidate.experience;
    const questionCount = interviewState.questionCount;
    
    // Fallback questions if API fails
    const fallbackQuestions = getFallbackQuestions(role, questionCount);
    
    try {
        const prompt = `Generate ${questionCount} diverse interview questions for a ${experience} candidate applying for ${role} position in an insurance company.
        Include:
        - 30% Multiple Choice Questions (with 4 options and correct answer marked)
        - 30% Technical/Regulatory questions specific to insurance
        - 20% Behavioral questions
        - 20% Situational/Customer service questions
        
        Format as JSON array with:
        - question (text)
        - type (mcq, technical, behavioral, situational, regulatory, or product)
        - difficulty (easy, medium, hard)
        - options (array for MCQ)
        - correctAnswer (index for MCQ)
        - keywords (important concepts)
        - sampleAnswer (ideal response)
        
        Example:
        [
            {
                "question": "What is the primary purpose of an insurance deductible?",
                "type": "mcq",
                "difficulty": "medium",
                "options": [
                    "To reduce the insurer's risk",
                    "To lower the policyholder's premium",
                    "To determine the policy limit",
                    "To calculate the claims payout"
                ],
                "correctAnswer": 0,
                "keywords": ["deductible", "insurance basics"],
                "sampleAnswer": "The primary purpose of a deductible is to reduce the insurer's risk by requiring the policyholder to share in the loss."
            }
        ]`;
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyA0dr_zXm5Bl-Vr1gizLi4tFBpekPpO3wA`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });
        
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0].content.parts[0].text) {
            throw new Error('Invalid API response format');
        }
        
        const responseText = data.candidates[0].content.parts[0].text;
        const jsonStart = responseText.indexOf('[');
        const jsonEnd = responseText.lastIndexOf(']') + 1;
        
        if (jsonStart === -1 || jsonEnd === -1) {
            throw new Error('Could not extract JSON from response');
        }
        
        const jsonString = responseText.slice(jsonStart, jsonEnd);
        interviewState.currentQuestions = JSON.parse(jsonString);
        
    } catch (error) {
        console.error('Error generating questions:', error);
        interviewState.currentQuestions = fallbackQuestions;
        displayAIMessage("Using carefully selected questions for this interview.", false);
    }
}

// Start the interview
function startInterview() {
    interviewState.startTime = new Date();
    startTimer();
    displayWelcomeMessage();
    interviewState.isInterviewStarted = true;
    
    // Initialize response dots
    updateResponseDots();
}

// Display welcome message from AI
function displayWelcomeMessage() {
    const welcomeMessage = `
    <div class="d-flex mb-3">
        <div class="flex-shrink-0 me-3">
            <div class="hr-avatar">${AI_AVATAR}</div>
        </div>
        <div class="ai-message p-3">
            <strong>${AI_NAME} (${AI_POSITION}):</strong> Hello ${interviewState.candidate.name}! Welcome to your interview for the ${interviewState.candidate.role} position at Hire Mind. 
            <br><br>
            This will be a conversational interview with a mix of question types. For multiple choice questions, you can say the option number (1, 2, 3, or 4) or the option text. For other questions, please take your time to respond thoughtfully - you'll have 15 seconds per question.
            <br><br>
            Let's begin with your introduction - please tell me about your professional journey and what interests you about the insurance industry.
        </div>
    </div>
    `;
    
    chatMessages.innerHTML += welcomeMessage;
    scrollToBottom();
    
    const welcomeSpeech = `Hello ${interviewState.candidate.name}! Welcome to your interview for the ${interviewState.candidate.role} position at Insurance Solutions. 
    This will be a conversational interview with a mix of question types. For multiple choice questions, say the option number or the option text. 
    For other questions, please take your time to respond thoughtfully - you'll have 15 seconds per question.
    Let's begin with your introduction - please tell me about your professional journey and what interests you about the insurance industry.`;
    
    speak(welcomeSpeech, true);
}

// Ask the current question
function askQuestion() {
    if (interviewState.currentQuestionIndex >= interviewState.currentQuestions.length) {
        endInterview();
        return;
    }
    
    const currentQuestion = interviewState.currentQuestions[interviewState.currentQuestionIndex];
    interviewState.isMCQ = currentQuestion.type === 'mcq';
    interviewState.currentMCQOptions = currentQuestion.options || [];
    
    // Update progress
    const progress = ((interviewState.currentQuestionIndex) / interviewState.currentQuestions.length) * 100;
    progressBar.style.width = `${progress}%`;
    questionCounter.textContent = `Question ${interviewState.currentQuestionIndex + 1} of ${interviewState.currentQuestions.length}`;
    
    // Start response timer
    startResponseTimer();
    
    let questionHtml = `
    <div class="d-flex mb-3">
        <div class="flex-shrink-0 me-3">
            <div class="hr-avatar">${AI_AVATAR}</div>
        </div>
        <div class="ai-message p-3">
            <strong>${AI_NAME}:</strong> ${currentQuestion.question} 
            <span class="badge float-end difficulty-${currentQuestion.difficulty}">${currentQuestion.difficulty}</span>
            <span class="badge float-end me-2 type-${currentQuestion.type}">${currentQuestion.type}</span>
    `;
    
    // Add MCQ options if available
    if (interviewState.isMCQ && currentQuestion.options) {
        questionHtml += `
            <div class="mt-3">
                ${currentQuestion.options.map((option, index) => `
                <div class="form-check">
                    <input class="form-check-input" type="radio" name="mcq-${interviewState.currentQuestionIndex}" id="option-${index}" value="${index}">
                    <label class="form-check-label" for="option-${index}">${String.fromCharCode(65 + index)}. ${option}</label>
                </div>
                `).join('')}
            </div>
        `;
    }
    
    questionHtml += `
        </div>
    </div>
    `;
    
    chatMessages.innerHTML += questionHtml;
    scrollToBottom();
    
    // Add answer input area for non-MCQ questions
    if (!interviewState.isMCQ) {
        const answerInputId = `answer-input-${interviewState.currentQuestionIndex}`;
        chatMessages.innerHTML += `
        <div class="answer-input mb-3">
            <div class="input-group">
                <textarea id="${answerInputId}" class="form-control" rows="3" placeholder="Type your answer here..."></textarea>
                <button class="btn btn-primary submit-answer" data-question-index="${interviewState.currentQuestionIndex}">Submit</button>
            </div>
        </div>
        `;
        
        // Add event listener for the submit button
        document.querySelector(`.submit-answer[data-question-index="${interviewState.currentQuestionIndex}"]`).addEventListener('click', handleTextAnswerSubmit);
    }
    
    // Update voice button text based on question type
    if (interviewState.isMCQ) {
        voiceBtn.innerHTML = '<i class="bi bi-mic-fill me-2"></i> Speak Answer (1-4 or option text)';
        voiceStatus.textContent = "Say the option number (1, 2, 3, or 4) or the option text";
    } else {
        voiceBtn.innerHTML = '<i class="bi bi-mic-fill me-2"></i> Speak Answer';
        voiceStatus.textContent = "Click the button and speak your answer";
    }
    
    // Speak the question
    speakQuestion(currentQuestion);
    
    // Record response start time
    interviewState.currentResponseStartTime = new Date();
}

// Start response timer (15 seconds)
function startResponseTimer() {
    responseTimerContainer.style.display = 'flex';
    let seconds = RESPONSE_TIME_LIMIT;
    responseTimer.textContent = seconds;
    
    // Clear any existing timer
    if (interviewState.responseTimerInterval) {
        clearInterval(interviewState.responseTimerInterval);
    }
    
    interviewState.responseTimerInterval = setInterval(() => {
        seconds--;
        responseTimer.textContent = seconds;
        
        if (seconds <= 5) {
            responseTimerText.classList.add('response-timeout');
            responseTimerText.textContent = "Respond soon!";
            responseTimer.style.borderColor = 'var(--danger-color)';
            responseTimer.style.color = 'var(--danger-color)';
        }
        
        if (seconds <= 0) {
            clearInterval(interviewState.responseTimerInterval);
            responseTimerText.textContent = "Time's up!";
            
            // If MCQ, select a random answer (penalty)
            if (interviewState.isMCQ) {
                const randomIndex = Math.floor(Math.random() * interviewState.currentMCQOptions.length);
                handleMCQAnswer(randomIndex + 1);
            } else {
                // For open-ended questions, submit empty answer
                handleTextAnswerSubmit({ target: document.querySelector(`.submit-answer[data-question-index="${interviewState.currentQuestionIndex}"]`) });
            }
        }
    }, 1000);
}

// Reset response timer
function resetResponseTimer() {
    clearInterval(interviewState.responseTimerInterval);
    responseTimerContainer.style.display = 'none';
    responseTimer.textContent = RESPONSE_TIME_LIMIT;
    responseTimerText.textContent = "seconds remaining";
    responseTimerText.classList.remove('response-timeout');
    responseTimer.style.borderColor = 'var(--primary-color)';
    responseTimer.style.color = 'var(--primary-color)';
}

// Update response dots visualization
function updateResponseDots() {
    responseDots.innerHTML = '';
    const totalQuestions = interviewState.currentQuestions.length;
    
    for (let i = 0; i < totalQuestions; i++) {
        const dot = document.createElement('div');
        dot.className = 'response-dot';
        if (i < interviewState.currentQuestionIndex) {
            dot.classList.add('active');
        }
        responseDots.appendChild(dot);
    }
}

// Speak question with options if MCQ
function speakQuestion(question) {
    let questionText = question.question;
    
    if (question.type === 'mcq' && question.options) {
        questionText += " Options are: ";
        question.options.forEach((option, index) => {
            questionText += `Option ${index + 1}: ${option}. `;
        });
    }
    
    speak(questionText);
}

// Handle MCQ answer selection
function handleMCQAnswer(selectedOption) {
    resetResponseTimer();
    
    // Calculate response time
    const responseEndTime = new Date();
    const responseTime = (responseEndTime - interviewState.currentResponseStartTime) / 1000;
    interviewState.responseTimes.push(responseTime);
    
    const currentQuestion = interviewState.currentQuestions[interviewState.currentQuestionIndex];
    const options = currentQuestion.options || [];
    
    // Try to parse as number (1-4)
    let selectedIndex = parseInt(selectedOption) - 1;
    
    // If not a number, try to match option text
    if (isNaN(selectedIndex)) {
        selectedIndex = options.findIndex(opt => 
            opt.toLowerCase().includes(selectedOption.toLowerCase()) ||
            selectedOption.toLowerCase().includes(opt.toLowerCase())
        );
    }
    
    // Validate selection
    if (selectedIndex < 0 || selectedIndex >= options.length) {
        displayAIMessage(`I didn't understand your selection. Please say the option number (1 to ${options.length}) or the option text.`);
        return;
    }
    
    // Store answer
    interviewState.answers.push({
        question: currentQuestion.question,
        answer: options[selectedIndex],
        isCorrect: selectedIndex === currentQuestion.correctAnswer,
        type: currentQuestion.type,
        difficulty: currentQuestion.difficulty,
        correctAnswer: options[currentQuestion.correctAnswer],
        responseTime: responseTime
    });
    
    // Display feedback immediately for MCQ
    const feedback = selectedIndex === currentQuestion.correctAnswer 
        ? "Correct! " + (currentQuestion.sampleAnswer || "")
        : `Incorrect. The correct answer was: ${options[currentQuestion.correctAnswer]}. ${currentQuestion.sampleAnswer || ""}`;
    
    const feedbackHtml = `
    <div class="d-flex mb-3">
        <div class="flex-shrink-0 me-3">
            <div class="hr-avatar">${AI_AVATAR}</div>
        </div>
        <div class="ai-message p-3">
            <strong>${AI_NAME}:</strong> ${feedback}
        </div>
    </div>
    `;
    
    chatMessages.innerHTML += feedbackHtml;
    scrollToBottom();
    speak(feedback);
    
    // Move to next question
    interviewState.currentQuestionIndex++;
    updateResponseDots();
    if (interviewState.currentQuestionIndex < interviewState.currentQuestions.length) {
        setTimeout(() => askQuestion(), 2000);
    } else {
        endInterview();
    }
}

// Handle text answer submission
function handleTextAnswerSubmit(e) {
    resetResponseTimer();
    
    const questionIndex = parseInt(e.target.getAttribute('data-question-index'));
    const answerInput = document.getElementById(`answer-input-${questionIndex}`);
    const answer = answerInput ? answerInput.value.trim() : "No answer provided";
    
    // Calculate response time
    const responseEndTime = new Date();
    const responseTime = (responseEndTime - interviewState.currentResponseStartTime) / 1000;
    interviewState.responseTimes.push(responseTime);
    
    // Remove the input area
    if (answerInput) {
        e.target.closest('.answer-input').remove();
    }
    
    // Display user's answer
    displayUserMessage(answer);
    
    // Evaluate the answer
    evaluateAnswer(answer);
}

// Evaluate answer
async function evaluateAnswer(answer) {
    const currentQuestion = interviewState.currentQuestions[interviewState.currentQuestionIndex];
    
    // Show evaluation in progress
    const evaluationId = 'eval-' + Date.now();
    chatMessages.innerHTML += `
    <div class="d-flex mb-3">
        <div class="flex-shrink-0 me-3">
            <div class="hr-avatar">${AI_AVATAR}</div>
        </div>
        <div class="ai-message p-3" id="${evaluationId}">
            <span class="typing-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span> Analyzing your response...</span>
        </div>
    </div>
    `;
    scrollToBottom();
    
    try {
        // Calculate a score based on answer length and keywords
        let score = Math.min(100, Math.floor(answer.length / 2));
        if (currentQuestion.keywords) {
            const keywordMatches = currentQuestion.keywords.filter(keyword => 
                answer.toLowerCase().includes(keyword.toLowerCase())
            ).length;
            score = Math.min(100, score + (keywordMatches * 10));
        }
        
        // Generate feedback based on score and content
        let feedback = "";
        let strengths = [];
        let improvements = [];
        
        if (score >= 80) {
            feedback = "Excellent response! You provided a comprehensive answer that addressed the question thoroughly.";
            strengths = ["Detailed explanation", "Relevant examples", "Clear communication", "Industry knowledge"];
            improvements = ["Consider adding more technical depth", "Could mention alternative approaches"];
        } else if (score >= 60) {
            feedback = "Good response. You covered the main points well.";
            strengths = ["Clear structure", "Relevant experience", "Good understanding"];
            improvements = ["Could provide more specific examples", "Consider expanding on technical aspects"];
        } else {
            feedback = "Thank you for your answer. Let me provide some suggestions for improvement.";
            strengths = ["Willingness to engage", "Attempt to address question"];
            improvements = ["Try to provide more detailed responses", "Consider structuring your answer more clearly", "Include specific examples from your experience"];
        }
        
        // Add specific feedback based on question type
        if (currentQuestion.type === 'technical' || currentQuestion.type === 'regulatory') {
            improvements.push("Consider discussing regulatory implications");
        } else if (currentQuestion.type === 'behavioral') {
            improvements.push("Try using the STAR method (Situation, Task, Action, Result)");
        } else if (currentQuestion.type === 'product') {
            improvements.push("Consider discussing customer needs and business impact");
        }
        
        const evaluation = {
            score: score,
            feedback: feedback,
            strengths: strengths,
            areasForImprovement: improvements
        };
        
        // Store answer with evaluation
        interviewState.answers.push({
            question: currentQuestion.question,
            answer: answer,
            evaluation: evaluation,
            type: currentQuestion.type,
            difficulty: currentQuestion.difficulty,
            responseTime: interviewState.responseTimes[interviewState.responseTimes.length - 1]
        });
        
        // Display evaluation
        const feedbackHtml = `
        <strong>${AI_NAME}:</strong> ${evaluation.feedback}
        <div class="mt-2">
            <strong>Score:</strong> ${evaluation.score}/100
        </div>
        <div class="mt-2">
            <strong>Strengths:</strong> ${evaluation.strengths.join(', ')}
        </div>
        <div class="mt-1">
            <strong>Suggestions:</strong> ${evaluation.areasForImprovement.join(', ')}
        </div>
        `;
        
        document.getElementById(evaluationId).innerHTML = feedbackHtml;
        scrollToBottom();
        speak(evaluation.feedback);
        
        // Move to next question
        interviewState.currentQuestionIndex++;
        updateResponseDots();
        if (interviewState.currentQuestionIndex < interviewState.currentQuestions.length) {
            setTimeout(() => askQuestion(), 3000);
        } else {
            endInterview();
        }
        
    } catch (error) {
        console.error('Error evaluating answer:', error);
        document.getElementById(evaluationId).innerHTML = `<strong>${AI_NAME}:</strong> Thank you for your answer. Let's continue with the next question.`;
        
        // Store answer without evaluation
        interviewState.answers.push({
            question: currentQuestion.question,
            answer: answer,
            evaluation: null,
            type: currentQuestion.type,
            difficulty: currentQuestion.difficulty,
            responseTime: interviewState.responseTimes[interviewState.responseTimes.length - 1]
        });
        
        // Move to next question
        interviewState.currentQuestionIndex++;
        updateResponseDots();
        if (interviewState.currentQuestionIndex < interviewState.currentQuestions.length) {
            setTimeout(() => askQuestion(), 2000);
        } else {
            endInterview();
        }
    }
}

// Initialize speech recognition with error handling
function initializeSpeechRecognition() {
    try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            showVoiceRecognitionError("Voice recognition not supported in your browser. Please use Chrome or Edge.");
            return;
        }
        
        interviewState.recognition = new SpeechRecognition();
        interviewState.recognition.continuous = false;
        interviewState.recognition.interimResults = false;
        interviewState.recognition.lang = 'en-US';
        
        interviewState.recognition.onresult = (event) => {
            if (event.results && event.results.length > 0) {
                const transcript = event.results[0][0].transcript.trim();
                
                if (interviewState.isMCQ) {
                    // Handle MCQ answer by voice
                    handleMCQAnswer(transcript);
                } else {
                    // Handle regular answer by voice
                    displayUserMessage(transcript);
                    evaluateAnswer(transcript);
                }
            }
            resetVoiceButton();
        };
        
        interviewState.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            let errorMessage = "Voice recognition error. Please try again.";
            
            switch(event.error) {
                case 'network':
                    errorMessage = "Network error occurred. Please check your internet connection.";
                    break;
                case 'not-allowed':
                    errorMessage = "Microphone access denied. Please allow microphone permissions.";
                    break;
                case 'service-not-allowed':
                    errorMessage = "Browser doesn't have permission to use microphone.";
                    break;
            }
            
            showVoiceRecognitionError(errorMessage);
            resetVoiceButton();
        };
        
        interviewState.recognition.onend = () => {
            if (!interviewState.isSpeaking) {
                resetVoiceButton();
            }
        };
        
    } catch (error) {
        console.error('Error initializing speech recognition:', error);
        showVoiceRecognitionError("Failed to initialize voice recognition. Please refresh the page.");
    }
}

// Show error message and provide fallback
function showVoiceRecognitionError(message) {
    voiceStatus.textContent = message;
    voiceStatus.style.color = "#dc3545";
    
    // Show text input fallback
    const inputGroup = document.createElement('div');
    inputGroup.className = 'input-group mt-3';
    inputGroup.innerHTML = `
        <input type="text" id="text-fallback-input" class="form-control" placeholder="Type your answer here...">
        <button id="text-fallback-submit" class="btn btn-primary">Submit</button>
    `;
    
    voiceStatus.after(inputGroup);
    
    document.getElementById('text-fallback-submit').addEventListener('click', () => {
        const answer = document.getElementById('text-fallback-input').value.trim();
        if (answer) {
            if (interviewState.isMCQ) {
                handleMCQAnswer(answer);
            } else {
                displayUserMessage(answer);
                evaluateAnswer(answer);
            }
            inputGroup.remove();
            resetVoiceButton();
        }
    });
}

// Handle voice button click with network awareness
function handleVoiceButtonClick() {
    if (!interviewState.isInterviewStarted) return;
    
    // Check online status
    if (!navigator.onLine) {
        showVoiceRecognitionError("You appear to be offline. Voice recognition requires internet connection.");
        return;
    }
    
    if (interviewState.isSpeaking) {
        stopVoiceRecording();
    } else {
        startVoiceRecording();
    }
}

// Start voice recording with permissions check
function startVoiceRecording() {
    // Check microphone permissions first
    navigator.permissions.query({name: 'microphone'}).then(permissionStatus => {
        if (permissionStatus.state === 'denied') {
            showVoiceRecognitionError("Microphone access blocked. Please enable it in browser settings.");
            return;
        }
        
        try {
            interviewState.recognition.start();
            interviewState.isSpeaking = true;
            voiceBtn.classList.add('listening');
            voiceBtn.innerHTML = '<i class="bi bi-mic-fill me-2"></i> Listening...';
            voiceStatus.textContent = "Speak now...";
            voiceStatus.style.color = "var(--primary-color)";
        } catch (err) {
            console.error('Error starting recognition:', err);
            showVoiceRecognitionError("Error accessing microphone. Please ensure it's connected and try again.");
        }
    }).catch(err => {
        console.error('Permission query error:', err);
        // Proceed with attempt if permission query fails
        try {
            interviewState.recognition.start();
            interviewState.isSpeaking = true;
            voiceBtn.classList.add('listening');
            voiceBtn.innerHTML = '<i class="bi bi-mic-fill me-2"></i> Listening...';
            voiceStatus.textContent = "Speak now...";
            voiceStatus.style.color = "var(--primary-color)";
        } catch (err) {
            console.error('Error starting recognition:', err);
            showVoiceRecognitionError("Error accessing microphone. Please ensure it's connected and try again.");
        }
    });
}

// Stop voice recording
function stopVoiceRecording() {
    interviewState.isSpeaking = false;
    try {
        interviewState.recognition.stop();
    } catch (err) {
        console.error('Error stopping recognition:', err);
    }
    resetVoiceButton();
}

// Reset voice button to initial state
function resetVoiceButton() {
    interviewState.isSpeaking = false;
    voiceBtn.classList.remove('listening');
    
    if (interviewState.isMCQ) {
        voiceBtn.innerHTML = '<i class="bi bi-mic-fill me-2"></i> Speak Answer (1-4 or option text)';
        voiceStatus.textContent = "Say the option number (1, 2, 3, or 4) or the option text";
    } else {
        voiceBtn.innerHTML = '<i class="bi bi-mic-fill me-2"></i> Speak Answer';
        voiceStatus.textContent = "Click the button and speak your answer";
    }
    
    voiceStatus.style.color = "var(--text-color)";
}

// Text-to-speech with female voice
function speak(text, isWelcome = false) {
    if ('speechSynthesis' in window) {
        // Cancel any previous speech
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Use female voice if available
        if (interviewState.femaleVoice) {
            utterance.voice = interviewState.femaleVoice;
        } else {
            // Fallback: try to find any female voice
            const voices = window.speechSynthesis.getVoices();
            const femaleVoice = voices.find(voice => 
                voice.name.includes('Female') || 
                voice.name.includes('Woman') ||
                voice.lang.includes('en-IN')
            );
            
            if (femaleVoice) {
                utterance.voice = femaleVoice;
            }
        }
        
        // Configure voice properties - slower and more natural
        utterance.rate = isWelcome ? 1.0 : 1.1; // Slower rate for more natural speech
        utterance.pitch = 1.7;
        utterance.volume = 1;
        
        window.speechSynthesis.speak(utterance);
    }
}

// End the interview
function endInterview() {
    clearInterval(interviewState.timerInterval);
    resetResponseTimer();
    
    if (interviewState.recognition) {
        interviewState.recognition.stop();
    }
    
    // Calculate score
    let totalScore = 0;
    let scoredAnswers = 0;
    let typeCounts = { mcq: 0, technical: 0, behavioral: 0, situational: 0, regulatory: 0, product: 0 };
    let typeScores = { mcq: 0, technical: 0, behavioral: 0, situational: 0, regulatory: 0, product: 0 };
    let correctMCQs = 0;
    let totalMCQs = 0;
    let totalResponseTime = 0;
    
    interviewState.answers.forEach(answer => {
        if (answer.type === 'mcq') {
            totalMCQs++;
            if (answer.isCorrect) correctMCQs++;
        }
        
        if (answer.evaluation?.score) {
            totalScore += answer.evaluation.score;
            scoredAnswers++;
            
            // Track by type
            typeCounts[answer.type]++;
            typeScores[answer.type] += answer.evaluation.score;
        }
        
        if (answer.responseTime) {
            totalResponseTime += answer.responseTime;
        }
    });
    
    const averageScore = scoredAnswers > 0 ? Math.round(totalScore / scoredAnswers) : 0;
    const mcqAccuracy = totalMCQs > 0 ? Math.round((correctMCQs / totalMCQs) * 100) : 0;
    const avgResponseTime = interviewState.answers.length > 0 ? (totalResponseTime / interviewState.answers.length).toFixed(1) : 0;
    
    // Calculate duration
    const endTime = new Date();
    const duration = Math.floor((endTime - interviewState.startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    const durationStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Display results
    interviewSection.style.display = 'none';
    resultsSection.style.display = 'block';
    
    // Populate candidate info
    document.getElementById('result-name').textContent = interviewState.candidate.name;
    document.getElementById('result-email').textContent = interviewState.candidate.email;
    document.getElementById('result-role').textContent = interviewState.candidate.role;
    document.getElementById('result-experience').textContent = interviewState.candidate.experience;
    
    // Populate interview summary
    document.getElementById('total-questions').textContent = interviewState.answers.length;
    document.getElementById('overall-score').textContent = `${averageScore}%`;
    document.getElementById('interview-duration').textContent = durationStr;
    document.getElementById('avg-response-time').textContent = `${avgResponseTime} seconds`;
    
    // Generate detailed feedback
    const feedbackHtml = interviewState.answers.map((answer, index) => {
        const hasEvaluation = answer.evaluation !== null;
        const isMCQ = answer.type === 'mcq';
        
        return `
        <div class="card mb-3">
            <div class="card-body">
                <h5 class="card-title">Question ${index + 1}: ${answer.question}</h5>
                <div class="d-flex justify-content-between mb-2">
                    <span class="badge difficulty-${answer.difficulty}">${answer.difficulty}</span>
                    <span class="badge type-${answer.type}">${answer.type}</span>
                    <small class="text-muted">Response time: ${answer.responseTime.toFixed(1)}s</small>
                </div>
                <p class="card-text"><strong>Your answer:</strong> ${answer.answer}</p>
                ${isMCQ ? `
                <div class="alert ${answer.isCorrect ? 'alert-success' : 'alert-danger'}">
                    ${answer.isCorrect ? 
                        '<strong>Correct!</strong>' : 
                        `<strong>Incorrect.</strong> The correct answer was: ${answer.correctAnswer}`
                    }
                </div>
                ` : ''}
                ${hasEvaluation ? `
                <div class="alert ${answer.evaluation.score >= 80 ? 'alert-success' : answer.evaluation.score >= 60 ? 'alert-warning' : 'alert-danger'}">
                    <div class="d-flex justify-content-between">
                        <strong>Score:</strong> 
                        <span>${answer.evaluation.score}/100</span>
                    </div>
                    <div class="mt-2"><strong>Feedback:</strong> ${answer.evaluation.feedback}</div>
                    ${answer.evaluation.strengths ? `
                    <div class="mt-2">
                        <strong>Strengths:</strong>
                        <ul class="mt-1 mb-0">
                            ${answer.evaluation.strengths.map(strength => `<li>${strength}</li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}
                    ${answer.evaluation.areasForImprovement ? `
                    <div class="mt-2">
                        <strong>Suggestions:</strong>
                        <ul class="mt-1 mb-0">
                            ${answer.evaluation.areasForImprovement.map(improvement => `<li>${improvement}</li>`).join('')}
                        </ul>
                    </div>
                    ` : ''}
                </div>
                ` : ''}
            </div>
        </div>
        `;
    }).join('');
    
    document.getElementById('detailed-feedback').innerHTML = feedbackHtml;
    
    // Generate overall assessment
    let assessment = `
    <div class="mb-3">
        <h5 class="mb-2">Performance Summary</h5>
        <div class="progress mb-3" style="height: 20px;">
            <div class="progress-bar" role="progressbar" style="width:title>Interview Report - ${interviewState.candidate.name}</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 1000px; margin: 0 auto; padding: 20px; }
            h1, h2, h3 { color: #005f87; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
            .candidate-info { margin-bottom: 30px; }
            .summary { background: #f9f9f9; padding: 20px; border-radius: 5px; margin-bottom: 30px; }
            .question { margin-bottom: 30px; border-bottom: 1px solid #eee; padding-bottom: 20px; }
            .question:last-child { border-bottom: none; }
            .badge { display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 12px; font-weight: bold; }
            .badge.easy { background: #d4edda; color: #155724; }
            .badge.medium { background: #fff3cd; color: #856404; }
            .badge.hard { background: #f8d7da; color: #721c24; }
            .badge.mcq { background: #d1ecf1; color: #0c5460; }
            .badge.technical { background: #e2e3e5; color: #383d41; }
            .badge.behavioral { background: #d1e7dd; color: #0f5132; }
            .badge.situational { background: #cfe2ff; color: #084298; }
            .badge.regulatory { background: #d6d8db; color: #1f2937; }
            .badge.product { background: #bee3f8; color: #1e429f; }
            .alert { padding: 15px; border-radius: 4px; margin-bottom: 15px; }
            .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .alert-danger { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            .alert-warning { background: #fff3cd; color: #856404; border: 1px solid #ffeeba; }
            .progress { height: 20px; background: #e9ecef; border-radius: 4px; margin-bottom: 10px; }
            .progress-bar { background: #005f87; }
            .row { display: flex; flex-wrap: wrap; margin: 0 -15px; }
            .col-md-6 { flex: 0 0 50%; max-width: 50%; padding: 0 15px; }
            @page { size: A4; margin: 1cm; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Interview Report</h1>
            <h2>${interviewState.candidate.role} Position</h2>
            <p>Insurance Solutions HR Department</p>
            <p>Generated on ${new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="candidate-info">
            <h3>Candidate Information</h3>
            <p><strong>Name:</strong> ${interviewState.candidate.name}</p>
            <p><strong>Email:</strong> ${interviewState.candidate.email}</p>
            <p><strong>Experience:</strong> ${interviewState.candidate.experience}</p>
        </div>
        
        <div class="summary">
            <h3>Interview Summary</h3>
            <p><strong>Total Questions:</strong> ${interviewState.answers.length}</p>
            <p><strong>Overall Score:</strong> ${calculateOverallScore()}%</p>
            ${calculateMCQAccuracy()}
            <p><strong>Interview Duration:</strong> ${document.getElementById('interview-duration').textContent}</p>
            <p><strong>Average Response Time:</strong> ${document.getElementById('avg-response-time').textContent}</p>
        </div>
        
        <h3>Detailed Feedback</h3>
        ${generateDetailedFeedbackForPDF()}
        
        <div class="overall-assessment">
            <h3>Overall Assessment</h3>
            ${generateOverallAssessmentForPDF()}
        </div>
    </body>
    </html>
    `;

    // Create a Blob with the HTML content
    const blob = new Blob([reportHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary anchor element to trigger the download
    const a = document.createElement('a');
    a.href = url;
    a.download = `Insurance_HR_Interview_Report_${interviewState.candidate.name.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

// Helper function to calculate overall score for PDF
function calculateOverallScore() {
    let totalScore = 0;
    let scoredAnswers = 0;
    
    interviewState.answers.forEach(answer => {
        if (answer.evaluation?.score) {
            totalScore += answer.evaluation.score;
            scoredAnswers++;
        } else if (answer.isCorrect !== undefined) {
            // For MCQs without evaluation
            totalScore += answer.isCorrect ? 100 : 0;
            scoredAnswers++;
        }
    });
    
    return scoredAnswers > 0 ? Math.round(totalScore / scoredAnswers) : 0;
}

// Helper function to calculate MCQ accuracy for PDF
function calculateMCQAccuracy() {
    let correctMCQs = 0;
    let totalMCQs = 0;
    
    interviewState.answers.forEach(answer => {
        if (answer.type === 'mcq') {
            totalMCQs++;
            if (answer.isCorrect) correctMCQs++;
        }
    });
    
    return totalMCQs > 0 ? 
        `<p><strong>MCQ Accuracy:</strong> ${Math.round((correctMCQs / totalMCQs) * 100)}% (${correctMCQs} out of ${totalMCQs} correct)</p>` : 
        '';
}

// Helper function to generate detailed feedback for PDF
function generateDetailedFeedbackForPDF() {
    return interviewState.answers.map((answer, index) => {
        const hasEvaluation = answer.evaluation !== null;
        const isMCQ = answer.type === 'mcq';
        
        return `
        <div class="question">
            <h4>Question ${index + 1}: ${answer.question}</h4>
            <div>
                <span class="badge difficulty-${answer.difficulty}">${answer.difficulty}</span>
                <span class="badge type-${answer.type}">${answer.type}</span>
                <small class="text-muted">Response time: ${answer.responseTime.toFixed(1)}s</small>
            </div>
            <p><strong>Your answer:</strong> ${answer.answer}</p>
            ${isMCQ ? `
            <div class="alert ${answer.isCorrect ? 'alert-success' : 'alert-danger'}">
                ${answer.isCorrect ? 
                    '<strong>Correct!</strong>' : 
                    `<strong>Incorrect.</strong> The correct answer was: ${answer.correctAnswer}`
                }
            </div>
            ` : ''}
            ${hasEvaluation ? `
            <div class="alert ${answer.evaluation.score >= 80 ? 'alert-success' : answer.evaluation.score >= 60 ? 'alert-warning' : 'alert-danger'}">
                <div><strong>Score:</strong> ${answer.evaluation.score}/100</div>
                <div class="mt-2"><strong>Feedback:</strong> ${answer.evaluation.feedback}</div>
                ${answer.evaluation.strengths ? `
                <div class="mt-2">
                    <strong>Strengths:</strong>
                    <ul>
                        ${answer.evaluation.strengths.map(strength => `<li>${strength}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
                ${answer.evaluation.areasForImprovement ? `
                <div class="mt-2">
                    <strong>Suggestions:</strong>
                    <ul>
                        ${answer.evaluation.areasForImprovement.map(improvement => `<li>${improvement}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
            </div>
            ` : ''}
        </div>
        `;
    }).join('');
}

// Helper function to generate overall assessment for PDF
function generateOverallAssessmentForPDF() {
    const overallScore = calculateOverallScore();
    
    if (overallScore >= 80) {
        return `
        <div class="alert alert-success">
            <h4>Excellent Performance!</h4>
            <p>You demonstrated strong knowledge and skills across all areas. Your responses were comprehensive and showed deep understanding of insurance concepts and HR practices.</p>
        </div>
        `;
    } else if (overallScore >= 60) {
        return `
        <div class="alert alert-warning">
            <h4>Good Performance</h4>
            <p>You showed solid understanding with some areas that could be strengthened. Review the detailed feedback for specific suggestions to improve your insurance industry knowledge.</p>
        </div>
        `;
    } else {
        return `
        <div class="alert alert-danger">
            <h4>Needs Improvement</h4>
            <p>There is room for improvement in your responses. We recommend reviewing insurance concepts, regulations, and practicing your interview skills.</p>
        </div>
        `;
    }
}

// Helper function to get alert class based on score
function getAlertClass(score) {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'danger';
}

// Display AI message
function displayAIMessage(message, isInitial = false) {
    const messageHtml = `
    <div class="d-flex mb-3">
        <div class="flex-shrink-0 me-3">
            <div class="hr-avatar">${AI_AVATAR}</div>
        </div>
        <div class="ai-message p-3">
            <strong>${isInitial ? AI_NAME + ' (' + AI_POSITION + ')' : AI_NAME}:</strong> ${message}
        </div>
    </div>
    `;
    
    chatMessages.innerHTML += messageHtml;
    scrollToBottom();
}

// Display user message
function displayUserMessage(message) {
    const messageHtml = `
    <div class="d-flex mb-3 justify-content-end">
        <div class="user-message p-3">
            <strong>You:</strong> ${message}
        </div>
        <div class="flex-shrink-0 ms-3">
            <div class="user-avatar">${interviewState.candidate.name.charAt(0).toUpperCase()}</div>
        </div>
    </div>
    `;
    
    chatMessages.innerHTML += messageHtml;
    scrollToBottom();
}

// Start timer
function startTimer() {
    let seconds = 0;
    interviewState.timerInterval = setInterval(() => {
        seconds++;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        timer.textContent = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }, 1000);
}



// Show warning
function showWarning(message) {
    interviewState.cheatingWarnings++;
    warningMessage.textContent = message;
    warningAlert.style.display = 'block';
    
    if (interviewState.cheatingWarnings >= 3) {
        endInterview();
        alert('Interview terminated due to multiple warnings. Please try again with full attention.');
    }
}

// Start a new interview
function startNewInterview() {

 // Stop any existing camera streams
    if (cameraFeed.srcObject) {
        cameraFeed.srcObject.getTracks().forEach(track => track.stop());
        cameraFeed.srcObject = null;
    }
   // Reset all interview state
    interviewState = {
        candidate: {},
        currentQuestions: [],
        currentQuestionIndex: 0,
        answers: [],
        startTime: null,
        timerInterval: null,
        responseTimerInterval: null,
        recognition: interviewState.recognition, // Keep recognition object
        isSpeaking: false,
        cheatingWarnings: 0,
        isTabActive: true,
        questionCount: 5,
        isInterviewStarted: false,
        femaleVoice: interviewState.femaleVoice, // Keep voice
        textInputFallback: false,
        isMCQ: false,
        currentMCQOptions: [],
        responseTimes: [],
        currentResponseStartTime: null,
        cameraAccessGranted: false
    };
 // Reset UI
    chatMessages.innerHTML = '';
    progressBar.style.width = '0%';
    questionCounter.textContent = 'Question 0 of 0';
    timer.textContent = '00:00';
    document.getElementById('detailed-feedback').innerHTML = '';
    document.getElementById('overall-assessment').innerHTML = 'Assessment will appear here';
    
    // Clear camera feed
    cameraFeed.innerHTML = '<div class="text-center p-4">Camera feed will appear here</div>';
    
    // Show registration form and hide other sections
    interviewSection.style.display = 'none';
    resultsSection.style.display = 'none';
    registrationSection.style.display = 'block';
    
    // Reset form fields
    document.getElementById('registration-form').reset();
}

// Fallback questions for insurance HR context
function getFallbackQuestions(role, count) {
    const allQuestions = [
        // MCQ Questions
        {
            question: "What is the primary purpose of an insurance deductible?",
            type: "mcq",
            difficulty: "medium",
            options: [
                "To reduce the insurer's risk",
                "To lower the policyholder's premium",
                "To determine the policy limit",
                "To calculate the claims payout"
            ],
            correctAnswer: 0,
            keywords: ["deductible", "insurance basics"],
            sampleAnswer: "The primary purpose of a deductible is to reduce the insurer's risk by requiring the policyholder to share in the loss."
        },
        {
            question: "Which of these is NOT a typical responsibility of an HR Business Partner in an insurance company?",
            type: "mcq",
            difficulty: "medium",
            options: [
                "Aligning HR strategy with business goals",
                "Underwriting insurance policies",
                "Employee relations and engagement",
                "Talent management and development"
            ],
            correctAnswer: 1,
            keywords: ["HR Business Partner", "responsibilities"],
            sampleAnswer: "Underwriting insurance policies is not typically an HR responsibility; it's handled by the underwriting department."
        },
        {
            question: "What does 'COBRA' refer to in employee benefits?",
            type: "mcq",
            difficulty: "hard",
            options: [
                "A type of health insurance for former employees",
                "A retirement savings plan",
                "A workers' compensation program",
                "A disability insurance provision"
            ],
            correctAnswer: 0,
            keywords: ["COBRA", "employee benefits"],
            sampleAnswer: "COBRA refers to the Consolidated Omnibus Budget Reconciliation Act, which provides continuing health insurance coverage for employees after leaving a company."
        },
        
        // Technical/Regulatory questions
        {
            question: "How would you explain the concept of 'utmost good faith' in insurance to a new employee?",
            type: "regulatory",
            difficulty: "hard",
            keywords: ["utmost good faith", "insurance principles", "disclosure"],
            sampleAnswer: "I'd explain that 'utmost good faith' (uberrimae fidei) is a fundamental principle in insurance requiring both parties to act honestly and disclose all material facts. The insured must disclose all relevant information, and the insurer must be transparent about policy terms. This principle helps maintain trust and prevents fraudulent claims."
        },
        {
            question: "Describe your approach to ensuring compliance with insurance regulations in HR policies.",
            type: "regulatory",
            difficulty: "hard",
            keywords: ["compliance", "regulations", "HR policies"],
            sampleAnswer: "I would regularly review state and federal insurance regulations, consult with legal and compliance teams, document all policies clearly, conduct training sessions for employees, and implement audit processes to ensure ongoing compliance. I'd also stay updated on regulatory changes through industry associations and continuing education."
        },
        
        // Scenario questions
        {
            question: "You're handling a situation where an employee is consistently late due to childcare issues. How would you address this while maintaining company policy?",
            type: "scenario",
            difficulty: "medium",
            keywords: ["employee relations", "flexibility", "policy"],
            sampleAnswer: "I would have a compassionate conversation to understand their specific challenges, explore flexible work arrangements if possible (like adjusted hours or remote work), while explaining the importance of reliability. If flexibility isn't possible, I'd help them explore company resources like EAP or childcare referrals, ensuring we balance empathy with business needs."
        },
        {
            question: "How would you handle a conflict between two team members over commission allocation?",
            type: "scenario",
            difficulty: "medium",
            keywords: ["conflict resolution", "compensation", "team dynamics"],
            sampleAnswer: "I would meet with each employee separately to understand their perspectives, review the commission policy together to ensure clarity, facilitate a joint meeting to find common ground, and if needed, propose adjustments to prevent future disputes while maintaining fairness and policy integrity."
        },
        
        // Behavioral questions
        {
            question: "Tell me about a time you had to implement a difficult HR policy change. How did you communicate it?",
            type: "behavioral",
            difficulty: "medium",
            keywords: ["change management", "communication", "policy implementation"],
            sampleAnswer: "When we needed to transition to a new benefits provider, I first thoroughly understood the changes, then developed a multi-channel communication plan including FAQs, town halls, and one-on-one sessions. I emphasized the reasons for the change and benefits to employees, while being transparent about challenges and available support."
        },
        {
            question: "Describe a time you identified a talent gap in your organization. How did you address it?",
            type: "behavioral",
            difficulty: "medium",
            keywords: ["talent management", "gap analysis", "workforce planning"],
            sampleAnswer: "I noticed we lacked digital skills in our claims department. I conducted a skills assessment, partnered with L&D to create upskilling programs, worked with recruiters to adjust hiring criteria, and implemented a mentorship program. Within a year, we improved digital competency by 40% across the team."
        },
        
        // Product/Insurance questions
        {
            question: "How would you explain the difference between term life and whole life insurance to a candidate unfamiliar with insurance products?",
            type: "product",
            difficulty: "easy",
            keywords: ["life insurance", "product knowledge", "communication"],
            sampleAnswer: "Term life insurance provides coverage for a specific period (like 20 years) at a fixed premium, with no cash value. Whole life insurance covers your entire life, builds cash value, and has higher premiums. Term is like renting coverage, while whole life is like buying with an investment component."
        },
        {
            question: "What factors would you consider when designing a benefits package for an insurance company's employees?",
            type: "product",
            difficulty: "hard",
            keywords: ["benefits", "compensation", "employee value proposition"],
            sampleAnswer: "I'd consider industry benchmarks, company budget, employee demographics and needs, regulatory requirements, competitive positioning, voluntary benefit options, communication strategy, and alignment with company values. For an insurance company, I'd emphasize robust health coverage, financial wellness programs, and professional development opportunities."
        }
    ];
    
    // Filter questions based on role
    const filteredQuestions = allQuestions.filter(q => {
        if (q.type !== "technical" && q.type !== "regulatory") return true;
        return q.keywords.some(k => ["HR", "compliance", "insurance"].includes(k));
    });
    
    // Shuffle and select requested number
    return shuffleArray(filteredQuestions).slice(0, count);
}

// Helper to shuffle array
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Scroll chat to bottom
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Load voices and initialize
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = init;
    }
    
    // Some browsers don't support onvoiceschanged
    setTimeout(init, 500);
});




// Replace setupTabMonitoring with this enhanced version
function setupPrivacyMonitoring() {
    // Window blur/focus detection (switching apps or browsers)
    interviewState.windowFocusListener = () => {
        if (!document.hasFocus() && interviewState.isInterviewStarted) {
            handlePrivacyViolation("Switched away from interview window");
        }
    };
    
    window.addEventListener('focus', interviewState.windowFocusListener);
    window.addEventListener('blur', interviewState.windowFocusListener);

    // Tab visibility detection
    interviewState.visibilityChangeListener = () => {
        if (document.hidden && interviewState.isInterviewStarted) {
            interviewState.blurTime = new Date().getTime();
            handlePrivacyViolation("Left interview tab");
        } else if (interviewState.isInterviewStarted) {
            // Check how long they were away
            if (interviewState.blurTime) {
                const blurDuration = new Date().getTime() - interviewState.blurTime;
                if (blurDuration > interviewState.maxBlurDuration) {
                    handlePrivacyViolation(`Left interview for ${Math.round(blurDuration/1000)} seconds`);
                }
            }
            interviewState.blurTime = null;
        }
    };
    
    document.addEventListener('visibilitychange', interviewState.visibilityChangeListener);

    // Prevent right-click and other context menus
    document.addEventListener('contextmenu', (e) => {
        if (interviewState.isInterviewStarted) {
            e.preventDefault();
            handlePrivacyViolation("Attempted to access context menu");
        }
    });

    // Detect keyboard shortcuts (Ctrl+T, Ctrl+N, etc.)
    document.addEventListener('keydown', (e) => {
        if (!interviewState.isInterviewStarted) return;
        
        // Block common browser shortcuts
        const blockedShortcuts = [
            e.ctrlKey && e.key === 't', // New tab
            e.ctrlKey && e.key === 'n', // New window
            e.ctrlKey && e.key === 'Tab', // Switch tabs
            e.altKey && e.key === 'Tab', // Switch apps
            e.key === 'F11', // Fullscreen
            e.ctrlKey && e.key === 'w', // Close tab
            e.ctrlKey && e.shiftKey && e.key === 'N', // Incognito
            e.key === 'Escape' // Try to exit fullscreen
        ];

        if (blockedShortcuts.some(Boolean)) {
            e.preventDefault();
            handlePrivacyViolation("Attempted browser shortcut");
        }
    });
}

// New function to handle privacy violations
function handlePrivacyViolation(reason) {
    if (!interviewState.strictPrivacyMode || !interviewState.isInterviewStarted) return;
    
    interviewState.privacyViolations++;
    
    // Immediate termination for any violation in strict mode
    if (interviewState.privacyViolations >= interviewState.maxPrivacyViolations) {
        // Clean up event listeners first
        cleanupPrivacyMonitoring();
        
        // Show termination message
        const terminationMsg = `
        <div class="alert alert-danger">
            <h4>Interview Terminated</h4>
            <p>Your interview has been terminated due to: ${reason}</p>
            <p>Our system detected activity that violates the interview integrity policy.</p>
        </div>
        `;
        
        if (chatMessages) {
            chatMessages.innerHTML += terminationMsg;
            scrollToBottom();
        }
        
        // End the interview immediately
        endInterview();
        
        // Show alert to user
        alert("Interview terminated due to violation of integrity policy. Please contact HR if you believe this was an error.");
        
        // Disable all interactive elements
        if (voiceBtn) voiceBtn.disabled = true;
        if (endInterviewBtn) endInterviewBtn.disabled = true;
        
        return;
    }
    
    // First violation warning
    showWarning(`Warning: ${reason}. Further violations will terminate the interview.`);
}

// Clean up privacy monitoring when interview ends
function cleanupPrivacyMonitoring() {
    if (interviewState.windowFocusListener) {
        window.removeEventListener('focus', interviewState.windowFocusListener);
        window.removeEventListener('blur', interviewState.windowFocusListener);
    }
    
    if (interviewState.visibilityChangeListener) {
        document.removeEventListener('visibilitychange', interviewState.visibilityChangeListener);
    }
}

// Modify endInterview to include cleanup
function endInterview() {
    cleanupPrivacyMonitoring();
    // ... rest of existing endInterview code ...
}

// Modify startNewInterview to reset privacy state
function startNewInterview() {
    // Reset privacy state
    interviewState.privacyViolations = 0;
    interviewState.blurTime = null;
    
    // Reinitialize monitoring
    setupPrivacyMonitoring();
    
    // ... rest of existing startNewInterview code ...
}