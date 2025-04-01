$(document).ready(function () {
  let currentScenario = 0;  // Start with scenario 0
  const categories = ['Medications', 'Compressions', 'Airways'];

  // Debug logging
  function logError(error) {
    console.error('Error:', error);
  }

  function logInfo(message) {
    console.log('Info:', message);
  }

  $('#startCode').on('click', function() {
    // Create and show questions before redirecting
    const container = document.createElement('div');
    container.id = 'questions-container';
    container.style.display = 'block';
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.left = '0';
    container.style.right = '0';
    container.style.padding = '20px';
    // container.style.backgroundColor = '#f8f9fa';
    container.style.backgroundColor = '#ffffff';
    // container.style.borderTop = '1px solid #dee2e6';
    container.style.textAlign = 'center';
    container.style.zIndex = '1000';
    container.style.fontSize = '50px';

    container.innerHTML = `
      <div class="question" id="pulse-question" style="margin-bottom: 15px;">
        <h3>Pulse?</h3>
        <button class="btn btn-primary" style="color: white;" onclick="handleInitialAnswer('pulse', true)">Yes</button>
        <button class="btn btn-primary" style="color: white;" onclick="handleInitialAnswer('pulse', false)">No</button>
      </div>
      <div class="question" id="rhythm-question" style="margin-bottom: 15px;">
        <h3>Shockable Rhythm?</h3>
        <button class="btn btn-primary" style="color: white;" onclick="handleInitialAnswer('rhythm', true)">Yes</button>
        <button class="btn btn-primary" style="color: white;" onclick="handleInitialAnswer('rhythm', false)">No</button>
      </div>
    `;

    document.body.appendChild(container);
  });

  // Global answers object for initial scenario selection
  window.initialAnswers = {};

  // Handle initial answers and redirect
  window.handleInitialAnswer = function(type, value) {
    initialAnswers[type] = value;

    // Disable the clicked buttons for this question
    const questionDiv = document.getElementById(`${type}-question`);
    if (questionDiv) {
      const buttons = questionDiv.getElementsByTagName('button');
      Array.from(buttons).forEach(button => {
        button.disabled = true;
        if (button.textContent.toLowerCase() === (value ? 'yes' : 'no')) {
          button.style.backgroundColor = '#28a745';
        } else {
          button.style.opacity = '0.5';
        }
      });
    }

    // Check if both questions are answered
    if ('pulse' in initialAnswers && 'rhythm' in initialAnswers) {
      // Check for invalid yes/yes combination
      if (initialAnswers.pulse && initialAnswers.rhythm) {
        // Reset answers
        initialAnswers = {};
        
        // Reset all buttons after a short delay
        setTimeout(() => {
          const container = document.getElementById('questions-container');
          if (container) {
            // Reset the container's HTML to its initial state
            container.innerHTML = `
              <div class="question" id="pulse-question" style="margin-bottom: 15px;">
                <h3>Pulse?</h3>
                <button class="btn btn-primary" style="color: white;" onclick="handleInitialAnswer('pulse', true)">Yes</button>
                <button class="btn btn-primary" style="color: white;" onclick="handleInitialAnswer('pulse', false)">No</button>
              </div>
              <div class="question" id="rhythm-question" style="margin-bottom: 15px;">
                <h3>Shockable Rhythm?</h3>
                <button class="btn btn-primary" style="color: white;" onclick="handleInitialAnswer('rhythm', true)">Yes</button>
                <button class="btn btn-primary" style="color: white;" onclick="handleInitialAnswer('rhythm', false)">No</button>
              </div>
            `;
          }
        }, 500);
        return;
      }

      // Determine the initial scenario
      let initialScenario;
      if (!initialAnswers.pulse && !initialAnswers.rhythm) {
        initialScenario = 0; // Asystole
      } else if (!initialAnswers.pulse && initialAnswers.rhythm) {
        initialScenario = 1; // Ventricular Fibrillation
      } else if (initialAnswers.pulse && !initialAnswers.rhythm) {
        initialScenario = 2; // Normal Sinus
      }

      // Redirect with the selected scenario after a short delay
      setTimeout(() => {
        window.location.href = `/start_code?scenario=${initialScenario}`;
      }, 1000);
    }
  };

  // Task Management
  class TaskManager {
    constructor() {
      // Get the scenario number from URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      this.currentScenario = parseInt(urlParams.get('scenario')) || 0;
      logInfo(`Initializing TaskManager with scenario: ${this.currentScenario}`);
      
      this.taskCounts = {};
      this.initializeTasks();
      this.setupQuestionPrompt();
      
      // Log all visible tasks and their states
      categories.forEach(category => {
        const container = document.getElementById(`${category.toLowerCase()}-tasks`);
        if (container) {
          const tasks = container.getElementsByClassName('task-item');
          logInfo(`Category ${category} has ${tasks.length} tasks`);
          Array.from(tasks).forEach((task, index) => {
            logInfo(`Task ${index + 1}: "${task.textContent.trim()}" (visible: ${task.style.display !== 'none'})`);
          });
        }
      });
      
      // Start timers immediately for initial scenario
      setTimeout(() => {
        logInfo('Starting initial countdowns for all tasks');
        this.startCountdownForTasks();
      }, 100);
      
      // Start the 15-second timer for questions
      setTimeout(() => {
        this.showQuestions();
      }, 15000);
    }

    setupQuestionPrompt() {
      // Create the questions container
      const container = document.createElement('div');
      container.id = 'questions-container';
      container.style.display = 'none';
      container.style.position = 'fixed';
      container.style.bottom = '20px';
      container.style.left = '0';
      container.style.right = '0';
      container.style.padding = '20px';
      container.style.backgroundColor = '#f8f9fa';
      container.style.borderTop = '1px solid #dee2e6';
      container.style.textAlign = 'center';

      // Store the initial HTML for resetting later
      this.questionsHTML = `
        <div class="question" id="pulse-question" style="margin-bottom: 15px;">
          <h3>Pulse?</h3>
          <button class="btn btn-primary" style="color: white;" onclick="window.taskManager.answerQuestion('pulse', true)">Yes</button>
          <button class="btn btn-primary" style="color: white;" onclick="window.taskManager.answerQuestion('pulse', false)">No</button>
        </div>
        <div class="question" id="rhythm-question" style="margin-bottom: 15px;">
          <h3>Shockable Rhythm?</h3>
          <button class="btn btn-primary" style="color: white;" onclick="window.taskManager.answerQuestion('rhythm', true)">Yes</button>
          <button class="btn btn-primary" style="color: white;" onclick="window.taskManager.answerQuestion('rhythm', false)">No</button>
        </div>
      `;

      container.innerHTML = this.questionsHTML;
      document.body.appendChild(container);
    }

    showQuestions() {
      const container = document.getElementById('questions-container');
      if (container) {
        // Reset the container's HTML to its initial state
        container.innerHTML = this.questionsHTML;
        container.style.display = 'block';
      }
    }

    answerQuestion(type, value) {
      if (!this.answers) {
        this.answers = {};
      }
      this.answers[type] = value;

      // Disable the clicked buttons for this question
      const questionDiv = document.getElementById(`${type}-question`);
      if (questionDiv) {
        const buttons = questionDiv.getElementsByTagName('button');
        Array.from(buttons).forEach(button => {
          button.disabled = true;
          if (button.textContent.toLowerCase() === (value ? 'yes' : 'no')) {
            button.style.backgroundColor = '#28a745';
          } else {
            button.style.opacity = '0.5';
          }
        });
      }

      // Check if both questions are answered
      if ('pulse' in this.answers && 'rhythm' in this.answers) {
        // Determine the scenario based on answers
        let newScenario;
        if (!this.answers.pulse && !this.answers.rhythm) {
          newScenario = 0; // Asystole
        } else if (!this.answers.pulse && this.answers.rhythm) {
          newScenario = 1; // Ventricular Fibrillation
        } else if (this.answers.pulse && !this.answers.rhythm) {
          newScenario = 2; // Normal Sinus
        }

        // Stop CPR lights before loading new scenario
        $.ajax({
          url: '/update_status',
          type: 'POST',
          data: {
            scenario: this.currentScenario,
            category: 'Compressions',
            action: 'cpr_stop'
          },
          success: (response) => {
            logInfo('CPR lights stopped before scenario transition');
            // Load the new scenario after a short delay
            setTimeout(() => {
              const container = document.getElementById('questions-container');
              if (container) {
                container.style.display = 'none';
              }
              this.loadScenario(newScenario);
              
              // Reset answers for next time
              this.answers = {};
              
              // Schedule next question prompt in 15 seconds
              setTimeout(() => {
                this.showQuestions();
              }, 15000);
            }, 1000);
          },
          error: (error) => {
            logError('Error stopping CPR lights before transition:', error);
            // Still proceed with scenario transition even if stopping CPR fails
            setTimeout(() => {
              const container = document.getElementById('questions-container');
              if (container) {
                container.style.display = 'none';
              }
              this.loadScenario(newScenario);
              
              // Reset answers for next time
              this.answers = {};
              
              // Schedule next question prompt in 15 seconds
              setTimeout(() => {
                this.showQuestions();
              }, 15000);
            }, 1000);
          }
        });
      }
    }

    loadScenario(scenarioNumber) {
      this.currentScenario = scenarioNumber;
      logInfo(`Loading scenario ${scenarioNumber}`);
      
      // Clear all existing countdowns
      categories.forEach(category => {
        if (this.taskCounts[category] && this.taskCounts[category].interval) {
          clearInterval(this.taskCounts[category].interval);
        }
      });
    
      // Reset all progress and clear tasks
      categories.forEach(category => {
        const container = document.getElementById(`${category.toLowerCase()}-tasks`);
        if (container) {
          container.innerHTML = ''; // Clear existing tasks
        }
        this.taskCounts[category] = {
          completed: 0,
          total: 0,
          tasks: []
        };
        this.updateProgressBar(category);
      });
    
      // Stop CPR lights when transitioning scenarios
      $.ajax({
        url: '/update_status',
        type: 'POST',
        data: {
          scenario: scenarioNumber,  // Use the new scenario number
          category: 'Compressions',
          action: 'cpr_stop'
        },
        success: (response) => {
          logInfo('CPR lights stopped during scenario transition');
          // Only load new tasks after CPR lights are stopped
          this.loadNewTasks(scenarioNumber);
        },
        error: (error) => {
          logError('Error stopping CPR lights during transition:', error);
          // Still load new tasks even if stopping CPR fails
          this.loadNewTasks(scenarioNumber);
        }
      });
    }

    // Helper method to load new tasks
    loadNewTasks(scenarioNumber) {
      $.ajax({
        url: '/obtain_status',
        type: 'POST',
        data: {
          scenario: scenarioNumber,
          category: 'all'
        },
        success: (response) => {
          logInfo('Received scenario data:', response);
          if (response.success && response.tasks) {
            // First, clear all existing tasks and timers
            categories.forEach(category => {
              const container = document.getElementById(`${category.toLowerCase()}-tasks`);
              if (container) {
                container.innerHTML = ''; // Clear existing tasks
              }
              // Clear any existing timer
              if (this.taskCounts[category] && this.taskCounts[category].interval) {
                clearInterval(this.taskCounts[category].interval);
                this.taskCounts[category].interval = null;
              }
            });

            // Then add new tasks
            categories.forEach(category => {
              const container = document.getElementById(`${category.toLowerCase()}-tasks`);
              if (container && response.tasks[category]) {
                const categoryTasks = response.tasks[category].steps;
                // Add new tasks
                categoryTasks.forEach(task => {
                  const taskElement = document.createElement('div');
                  taskElement.className = 'task-item';
                  taskElement.textContent = task[0];
                  taskElement.dataset.step = task[1];
                  container.appendChild(taskElement);
                });
                
                // Ensure progress bar is visible
                const progressContainer = document.getElementById(`progress-container-${category.toLowerCase()}`);
                const progressBar = document.getElementById(`progress-bar-${category.toLowerCase()}`);
                if (progressContainer) {
                  progressContainer.style.display = 'block';
                  logInfo(`Progress container for ${category} is visible`);
                }
                if (progressBar) {
                  progressBar.style.display = 'block';
                  progressBar.style.width = '100%';
                  progressBar.style.backgroundColor = '#4CAF50';
                  logInfo(`Progress bar for ${category} is visible and initialized`);
                }
                
                // Reinitialize task tracking
                this.initializeCategory(category);
              }
            });
    
            // Start countdowns for all tasks with a slight delay to ensure DOM is ready
            setTimeout(() => {
              logInfo('Starting countdowns after loading new tasks');
            this.startCountdownForTasks();
            }, 100);
          } else {
            logError('Failed to load scenario tasks:', response.message);
          }
        },
        error: (error) => {
          logError('Failed to load scenario:', error);
        }
      });
    }

    initializeCategory(category) {
      const container = document.getElementById(`${category.toLowerCase()}-tasks`);
      if (container) {
        const tasks = container.getElementsByClassName('task-item');
        this.taskCounts[category] = {
          total: tasks.length,
          completed: 0,
          tasks: Array.from(tasks).map((task, index) => {
            // Only display the first task, hide the rest
            if (index > 0) {
              task.style.display = 'none';
            }
            // Center align the task text
            task.style.textAlign = 'center';
            return {
              element: task,
              completed: false
            };
          })
        };
        
        // Ensure progress bar is visible and initialized
        const progressContainer = document.getElementById(`progress-container-${category.toLowerCase()}`);
        const progressBar = document.getElementById(`progress-bar-${category.toLowerCase()}`);
        if (progressContainer) {
          progressContainer.style.display = 'block';
          logInfo(`Progress container for ${category} is visible in initializeCategory`);
        }
        if (progressBar) {
          progressBar.style.display = 'block';
          progressBar.style.width = '100%';
          progressBar.style.backgroundColor = '#4CAF50';
          logInfo(`Progress bar for ${category} is visible and initialized in initializeCategory`);
        }
        
        logInfo(`Initialized ${category} with ${tasks.length} tasks`);
        this.updateProgressBar(category);
      }
    }

    initializeTasks() {
      categories.forEach(category => this.initializeCategory(category));
    }

    updateProgressBar(category) {
      const progressBar = document.getElementById(`progress-bar-${category.toLowerCase()}`);
      if (progressBar && this.taskCounts[category]) {
        const progress = (this.taskCounts[category].completed / this.taskCounts[category].total) * 100;
        progressBar.style.width = `${progress}%`;
        
        // Update color based on new thresholds
        if (progress < 34) {
          progressBar.style.backgroundColor = '#ff4444';  // Red
        } else if (progress < 67) {
          progressBar.style.backgroundColor = '#ffeb3b';  // Yellow
        } else {
          progressBar.style.backgroundColor = '#4CAF50';  // Green
        }
        
        logInfo(`Updated progress for ${category}: ${progress}%`);
      }
    }

    completeTask(category) {
      const categoryData = this.taskCounts[category];
      if (categoryData && categoryData.completed < categoryData.total) {
        const currentTaskData = categoryData.tasks[categoryData.completed];
        if (currentTaskData && !currentTaskData.completed) {
          const currentTask = currentTaskData.element.textContent.trim();
          logInfo(`Attempting to complete task: "${currentTask}" in category: ${category}`);
          
          // Check if completing a CPR task and send stop signal
          if (currentTask === 'CPR' && category === 'Compressions') {
            logInfo('Attempting to stop CPR lights');
            // Set flag to prevent starting CPR lights during completion
            this.isCompletingCPR = true;
            
            // Send stop signal to Arduino and wait for confirmation
            let retryCount = 0;
            const maxRetries = 3;
            
            const attemptStopCPR = () => {
              logInfo(`Sending CPR stop signal (attempt ${retryCount + 1}/${maxRetries})`);
              $.ajax({
                url: '/update_status',
                type: 'POST',
                data: {
                  scenario: this.currentScenario,
                  category: category,
                  action: 'cpr_stop'
                },
                success: (response) => {
                  logInfo('CPR stop response:', response);
                  if (response.success) {
                    logInfo('CPR stop signal successful, proceeding with task completion');
                    // Only proceed with task completion after successful signal
                    this.finishTaskCompletion(category, categoryData, currentTaskData);
                    // Start new countdown for next task if any
                    if (categoryData.completed < categoryData.total) {
                      setTimeout(() => {
                        this.startCountdown(category);
                      }, 50);
                    }
                  } else if (retryCount < maxRetries) {
                    // Retry if failed
                    retryCount++;
                    logInfo(`Retrying CPR stop signal, attempt ${retryCount}`);
                    setTimeout(attemptStopCPR, 100);
                  } else {
                    logError('Failed to stop CPR lights after multiple attempts');
                    // Still complete the task even if we couldn't stop the lights
                    this.finishTaskCompletion(category, categoryData, currentTaskData);
                  }
                  // Clear the flag after completion or failure
                  this.isCompletingCPR = false;
                },
                error: (error) => {
                  logError('Error stopping CPR lights:', error);
                  if (retryCount < maxRetries) {
                    // Retry if failed
                    retryCount++;
                    logInfo(`Retrying CPR stop signal after error, attempt ${retryCount}`);
                    setTimeout(attemptStopCPR, 100);
                  } else {
                    logError('Failed to stop CPR lights after multiple attempts');
                    // Still complete the task even if we couldn't stop the lights
                    this.finishTaskCompletion(category, categoryData, currentTaskData);
                  }
                  // Clear the flag after completion or failure
                  this.isCompletingCPR = false;
                }
              });
            };

            // Start the first attempt
            attemptStopCPR();
            return true;
          } else {
            logInfo(`Completing non-CPR task: "${currentTask}"`);
            // For non-CPR tasks, proceed normally
            this.finishTaskCompletion(category, categoryData, currentTaskData);
            // Start new countdown for next task if any
            if (categoryData.completed < categoryData.total) {
              setTimeout(() => {
                this.startCountdown(category);
              }, 50);
            }
            return true;
          }
        }
      }
      return false;
    }

    // Helper method to handle task completion
    finishTaskCompletion(category, categoryData, currentTaskData) {
          // Mark the current task as completed
          currentTaskData.completed = true;
          currentTaskData.element.classList.add('completed');
          currentTaskData.element.style.backgroundColor = '#e8f5e9';
          currentTaskData.element.style.borderColor = '#81c784';
          currentTaskData.element.style.color = '#2e7d32';
    
          // Hide the current task
          currentTaskData.element.style.display = 'none';
    
          // Move to the next task
          categoryData.completed++;
          
          // Check if this was the last task
          if (categoryData.completed >= categoryData.total) {
        // Only hide timer when all tasks are completed
            const lowerCategory = category.toLowerCase();
            const timerElement = document.getElementById(`timer-${lowerCategory}`);
            if (timerElement) timerElement.style.display = 'none';
            
            // Clear any existing timer
            if (this.taskCounts[category].interval) {
              clearInterval(this.taskCounts[category].interval);
              this.taskCounts[category].interval = null;
            }
          } else {
            // Show next task if not the last one
            const nextTaskData = categoryData.tasks[categoryData.completed];
            nextTaskData.element.style.display = 'block';
          }
    
          // Update progress bar and record interaction
          this.updateProgressBar(category);
          this.recordInteraction(category, 'complete');
    
          logInfo(`Completed task ${categoryData.completed} in ${category}`);
    }

    undoTask(category) {
      const categoryData = this.taskCounts[category];
      if (categoryData && categoryData.completed > 0) {
        const lastTaskData = categoryData.tasks[categoryData.completed - 1];
        if (lastTaskData && lastTaskData.completed) {
          // Mark task as incomplete
          lastTaskData.completed = false;
          lastTaskData.element.classList.remove('completed');
          
          // Reset visual style
          lastTaskData.element.style.backgroundColor = '';
          lastTaskData.element.style.borderColor = '';
          lastTaskData.element.style.color = '';
          
          // Update counts and progress
          categoryData.completed--;
          this.updateProgressBar(category);
          
          // Record interaction
          this.recordInteraction(category, 'undo');
          
          logInfo(`Undid task ${categoryData.completed + 1} in ${category}`);
          return true;
        }
      }
      return false;
    }

    recordInteraction(category, action) {
      $.ajax({
        type: 'POST',
        url: '/record_interaction',
        data: { 
          category: category,
          action: action,
          scenario: this.currentScenario
        },
        success: function(response) {
          logInfo(`Recorded ${action} interaction for ${category}`);
        },
        error: function(error) {
          logError(`Failed to record interaction for ${category}`);
        }
      });
    }

    reattachEventListeners() {
      categories.forEach(category => {
        const completeBtn = document.getElementById(`complete-${category.toLowerCase()}`);
        const undoBtn = document.getElementById(`undo-${category.toLowerCase()}`);
        
        if (completeBtn) {
          const newCompleteBtn = completeBtn.cloneNode(true);
          completeBtn.parentNode.replaceChild(newCompleteBtn, completeBtn);
          newCompleteBtn.addEventListener('click', () => handleTaskUpdate(category));
        }
      });
    }

    startCountdownForTasks() {
      logInfo('Starting countdowns for all tasks');
      categories.forEach(category => {
        const container = document.getElementById(`${category.toLowerCase()}-tasks`);
        if (container) {
          const tasks = container.getElementsByClassName('task-item');
          const visibleTasks = Array.from(tasks).filter(task => task.style.display !== 'none');
          logInfo(`Category ${category} has ${visibleTasks.length} visible tasks`);
          visibleTasks.forEach((task, index) => {
            logInfo(`Visible task ${index + 1}: "${task.textContent.trim()}"`);
          });
        }
        this.startCountdown(category);
      });
    }

    startCountdown(category) {
      const lowerCategory = category.toLowerCase();
      const progressBar = document.getElementById(`progress-bar-${lowerCategory}`);
      const timerLabel = document.getElementById(`timer-${lowerCategory}`);
      const duration = 20; // 20 seconds

      logInfo(`Starting countdown check for category: ${category} in scenario: ${this.currentScenario}`);

      // Clear any existing interval
      if (this.taskCounts[category] && this.taskCounts[category].interval) {
        clearInterval(this.taskCounts[category].interval);
      }

      // Check if there are remaining tasks
      const taskContainer = document.getElementById(`${lowerCategory}-tasks`);
      const tasks = taskContainer ? Array.from(taskContainer.getElementsByClassName('task-item')).filter(task => task.style.display !== 'none') : [];
      const hasRemainingTasks = tasks.length > 0;
      const currentTask = tasks[0] ? tasks[0].textContent.trim() : '';

      logInfo(`Current task for ${category}: "${currentTask}" in scenario ${this.currentScenario}`);
      logInfo(`Has remaining tasks: ${hasRemainingTasks}`);

      // Handle CPR task - send signal to Arduino
      // Only start CPR lights if:
      // 1. The current task is CPR
      // 2. We're in the Compressions category (Provider 2)
      // 3. We're not in the middle of completing a CPR task
      // 4. The task is actually visible (current active task)
      // 5. We're not already sending a CPR signal
      // 6. The task is the first visible task in the list
      if (currentTask === 'CPR' && 
          category === 'Compressions' && 
          !this.isCompletingCPR && 
          tasks[0] && 
          tasks[0].style.display !== 'none' &&
          !this.isSendingCPRSignal &&
          tasks[0] === tasks[0]) {  // Ensure it's the first visible task
          
        this.isSendingCPRSignal = true;
        logInfo(`Starting CPR lights for task: "${currentTask}" in scenario ${this.currentScenario}`);
        
        $.ajax({
          url: '/update_status',
          type: 'POST',
          data: {
            scenario: this.currentScenario,
            category: category,
            action: 'cpr_start'
          },
          success: (response) => {
            this.isSendingCPRSignal = false;
            if (response.success) {
              logInfo('CPR lights started successfully');
            } else {
              logError('Failed to start CPR lights:', response.message);
              // Retry once if failed
              setTimeout(() => {
                $.ajax({
                  url: '/update_status',
                  type: 'POST',
                  data: {
                    scenario: this.currentScenario,
                    category: category,
                    action: 'cpr_start'
                  },
                  success: (retryResponse) => {
                    if (retryResponse.success) {
                      logInfo('CPR lights started successfully on retry');
                    } else {
                      logError('Failed to start CPR lights on retry:', retryResponse.message);
                    }
                  }
                });
              }, 100);
            }
          },
          error: (error) => {
            this.isSendingCPRSignal = false;
            logError('Error starting CPR lights:', error);
            // Retry once if failed
            setTimeout(() => {
              $.ajax({
                url: '/update_status',
                type: 'POST',
                data: {
                  scenario: this.currentScenario,
                  category: category,
                  action: 'cpr_start'
                }
              });
            }, 100);
          }
        });
      } else if (currentTask === 'CPR') {
        logInfo(`CPR task detected but conditions not met for starting lights:`, {
          category,
          isCompletingCPR: this.isCompletingCPR,
          isSendingCPRSignal: this.isSendingCPRSignal,
          isFirstVisibleTask: tasks[0] && tasks[0].style.display !== 'none'
        });
      }

      // Define countdown tasks and ensure case-insensitive comparison
      const countdownTasks = [
        'Give Epi',
        'Give Amiodarone',
        'Give Bicarbonate',
        'Shock',
        'Give Epinephrine',
        'Give Amiodarone',
        'Give Sodium Bicarbonate',
        'Defibrillate'
      ];

      // Log all tasks that should have countdowns
      logInfo('Tasks that should have countdowns:', countdownTasks);
      
      const shouldShowCountdown = countdownTasks.some(task => {
        const matches = currentTask.toLowerCase() === task.toLowerCase();
        logInfo(`Comparing "${currentTask}" with "${task}": ${matches}`);
        return matches;
      });

      logInfo(`Should show countdown for task "${currentTask}": ${shouldShowCountdown}`);

      if (progressBar && timerLabel) {
        // Always show progress bar for all tasks
        progressBar.style.transition = 'none';
        progressBar.style.width = '100%';
        progressBar.style.backgroundColor = '#4CAF50';  // Start with green
        progressBar.style.display = 'block';
        
        // Show/hide timer based on current task
        timerLabel.style.display = shouldShowCountdown ? 'block' : 'none';
        logInfo(`Timer visibility set to: ${shouldShowCountdown ? 'visible' : 'hidden'}`);
        
        // Force reflow
        progressBar.offsetHeight;
        
        // Add smooth transition
        progressBar.style.transition = 'width 1s linear, background-color 0.3s ease';
        
        if (shouldShowCountdown) {
          logInfo(`Starting countdown for task: ${currentTask} in scenario ${this.currentScenario}`);
        let remainingTime = duration;
        timerLabel.textContent = `${remainingTime}s`;

        // Start the countdown
        const interval = setInterval(() => {
          remainingTime--;
          if (remainingTime >= 0) {
            const progressPercentage = (remainingTime / duration) * 100;
            progressBar.style.width = `${progressPercentage}%`;
            timerLabel.textContent = `${remainingTime}s`;

              // Update color based on time remaining
              if (remainingTime <= 7) {  // Last 7 seconds
                progressBar.style.backgroundColor = '#ff4444';  // Red
              } else if (remainingTime <= 14) {  // 8-14 seconds
                progressBar.style.backgroundColor = '#ffeb3b';  // Yellow
              } else {  // 15-20 seconds
                progressBar.style.backgroundColor = '#4CAF50';  // Green
              }
          } else {
            clearInterval(interval);
            timerLabel.textContent = 'Time Up!';
              progressBar.style.backgroundColor = '#ff4444';  // Red when time is up
              logInfo(`Countdown finished for task: ${currentTask}`);
          }
        }, 1000);

        // Store the interval ID
        this.taskCounts[category].interval = interval;
        } else {
          // For non-countdown tasks, keep progress bar at 100% and green
          progressBar.style.width = '100%';
          progressBar.style.backgroundColor = '#4CAF50';
        }
      } else {
        logInfo(`Progress bar or timer label not found for category ${category}`);
      }
    }
  }

  // Initialize TaskManager when on code blue page
  if (document.getElementById('medications-tasks')) {
    const taskManager = new TaskManager();
    // Make taskManager available globally for the button callbacks
    window.taskManager = taskManager;

    function handleTaskUpdate(category) {
      logInfo(`Attempting to update task for ${category} in scenario ${taskManager.currentScenario}`);
      
      // Clear existing timer immediately
      if (taskManager.taskCounts[category] && taskManager.taskCounts[category].interval) {
        clearInterval(taskManager.taskCounts[category].interval);
      }

      // Reset progress bar immediately
      const progressBar = document.getElementById(`progress-bar-${category.toLowerCase()}`);
      if (progressBar) {
        progressBar.style.transition = 'none';
        progressBar.style.width = '100%';
        progressBar.style.backgroundColor = '';
        progressBar.offsetHeight; // Force reflow
      }

      $.ajax({
        url: '/update_status',
        type: 'POST',
        data: {
          scenario: taskManager.currentScenario,
          category: category
        },
        success: function(response) {
          logInfo(`Server response for ${category}:`, response);
          if (response.success) {
            if (taskManager.completeTask(category)) {
              logInfo(`Successfully completed task for ${category}`);
              // Start new countdown with a slight delay to ensure clean transition
              setTimeout(() => {
                taskManager.startCountdown(category);
              }, 50);
            } else {
              logError(`Failed to complete task for ${category}`);
            }
          }
        },
        error: function(error) {
          logError(`Failed to update task for ${category}:`, error);
        }
      });
    }

    // Add event listeners for complete and undo buttons
    categories.forEach(category => {
      const completeBtn = document.getElementById(`complete-${category.toLowerCase()}`);
      const undoBtn = document.getElementById(`undo-${category.toLowerCase()}`);
      
      if (completeBtn) {
        // Remove any existing event listeners
        completeBtn.replaceWith(completeBtn.cloneNode(true));
        const newCompleteBtn = document.getElementById(`complete-${category.toLowerCase()}`);
        newCompleteBtn.addEventListener('click', () => handleTaskUpdate(category));
      }
    });
  }

  // Timer functionality
  if (document.getElementById('runningTimer')) {
    let startTime = Date.now();
    setInterval(() => {
      const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(elapsedTime / 60);
      const seconds = elapsedTime % 60;
      const timerElement = document.getElementById('runningTimer');
      if (timerElement) {
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    }, 1000);
  }

  // Exit button functionality
  const closeButton = document.getElementById('close_window');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      window.location.href = '/upload_page';
    });
  }

  // Socket.io setup
  const socket = io();
  
  socket.on('connect', () => logInfo('Connected to server'));
  socket.on('disconnect', () => logInfo('Disconnected from server'));
});




