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
    window.location.href = '/start_code';
  });

  // Task Management
  class TaskManager {
    constructor() {
      this.currentScenario = currentScenario;
      this.taskCounts = {};
      this.initializeTasks();
      this.setupScenarioControls();
    }

    setupScenarioControls() {
      // Add scenario controls to the UI
      const headerContainer = document.querySelector('.headercontainer');
      if (headerContainer) {
        const scenarioControl = document.createElement('div');
        scenarioControl.className = 'scenario-control';
        scenarioControl.innerHTML = `
          <label>Scenario: </label>
          <select id="scenario-selector">
            <option value="0">Asystole</option>
            <option value="1">Ventricular Fibrillation</option>
            <option value="2">Normal Sinus</option>
          </select>
        `;
        headerContainer.insertBefore(scenarioControl, headerContainer.firstChild);

        // Add event listener for scenario changes
        const selector = document.getElementById('scenario-selector');
        selector.addEventListener('change', (e) => {
          currentScenario = parseInt(e.target.value);
          this.loadScenario(currentScenario);
        });
      }
    }

    loadScenario(scenarioNumber) {
      this.currentScenario = scenarioNumber;
      logInfo(`Loading scenario ${scenarioNumber}`);
      
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

      // Load new tasks for the scenario
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
                // Reinitialize task tracking
                this.initializeCategory(category);
              }
            });

            // Reattach event listeners for all buttons
            this.reattachEventListeners();
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
          tasks: Array.from(tasks).map(task => ({
            element: task,
            completed: false
          }))
        };
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
        const nextTaskData = categoryData.tasks[categoryData.completed];
        if (nextTaskData && !nextTaskData.completed) {
          // Mark task as completed
          nextTaskData.completed = true;
          nextTaskData.element.classList.add('completed');
          
          // Visual feedback
          nextTaskData.element.style.backgroundColor = '#e8f5e9';
          nextTaskData.element.style.borderColor = '#81c784';
          nextTaskData.element.style.color = '#2e7d32';
          
          // Update counts and progress
          categoryData.completed++;
          this.updateProgressBar(category);
          
          // Record interaction
          this.recordInteraction(category, 'complete');
          
          logInfo(`Completed task ${categoryData.completed} in ${category}`);
          return true;
        }
      }
      return false;
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
        
        if (undoBtn) {
          const newUndoBtn = undoBtn.cloneNode(true);
          undoBtn.parentNode.replaceChild(newUndoBtn, undoBtn);
          newUndoBtn.addEventListener('click', () => handleTaskUndo(category));
        }
      });
    }
  }

  // Initialize TaskManager when on code blue page
  if (document.getElementById('medications-tasks')) {
    const taskManager = new TaskManager();

    // Update task completion handlers
    function handleTaskUpdate(category) {
      logInfo(`Attempting to update task for ${category}`);
      $.ajax({
        url: '/update_status',
        type: 'POST',
        data: {
          scenario: currentScenario,
          category: category
        },
        success: function(response) {
          logInfo(`Server response for ${category}:`, response);
          if (response.success) {
            if (taskManager.completeTask(category)) {
              logInfo(`Successfully completed task for ${category}`);
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

    // Undo task handlers
    function handleTaskUndo(category) {
      logInfo(`Attempting to undo task for ${category}`);
      $.ajax({
        url: '/undo_step',
        type: 'POST',
        data: {
          scenario: currentScenario,
          category: category
        },
        success: function(response) {
          logInfo(`Server response for undo ${category}:`, response);
          if (response.success) {
            if (taskManager.undoTask(category)) {
              logInfo(`Successfully undid task for ${category}`);
            } else {
              logError(`Failed to undo task for ${category}`);
            }
          }
        },
        error: function(error) {
          logError(`Failed to undo task for ${category}:`, error);
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
      
      if (undoBtn) {
        // Remove any existing event listeners
        undoBtn.replaceWith(undoBtn.cloneNode(true));
        const newUndoBtn = document.getElementById(`undo-${category.toLowerCase()}`);
        newUndoBtn.addEventListener('click', () => handleTaskUndo(category));
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

  // Close window functionality
  const closeButton = document.getElementById('close_window');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      fetch('/close_window', { method: 'POST' });
    });
  }

  // Socket.io setup
  const socket = io();
  
  socket.on('connect', () => logInfo('Connected to server'));
  socket.on('disconnect', () => logInfo('Disconnected from server'));
});


